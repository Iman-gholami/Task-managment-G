import hashlib
import importlib.util
import json
from pathlib import Path
import tempfile
import unittest
from unittest.mock import patch

SCRIPT = Path(__file__).resolve().parents[1] / "scripts" / "offline-update.py"
spec = importlib.util.spec_from_file_location("sentinel_offline_update", SCRIPT)
updater = importlib.util.module_from_spec(spec)
spec.loader.exec_module(updater)


class OfflineUpdateTests(unittest.TestCase):
    def test_replaces_only_target_service_image(self):
        before = """services:
  app:
    image: sentinel-ops:1.2.0
    environment:
      DATABASE_PATH: /app/data/sentinel.db
    volumes:
      - /srv/sentinel-ops/data:/app/data
  backup:
    image: busybox:latest
"""
        after = updater.replace_service_image(before, "app", "sentinel-ops:1.3.0")
        self.assertIn("image: sentinel-ops:1.3.0", after)
        self.assertIn("image: busybox:latest", after)
        self.assertIn("/srv/sentinel-ops/data:/app/data", after)
        self.assertIn("DATABASE_PATH: /app/data/sentinel.db", after)

    def test_refuses_missing_or_ambiguous_service_image(self):
        with self.assertRaisesRegex(RuntimeError, "one top-level image"):
            updater.replace_service_image("services:\n  app:\n    ports: []\n", "app", "sentinel-ops:1.3.0")

    def test_refuses_environment_image_interpolation(self):
        with self.assertRaisesRegex(RuntimeError, "environment substitution"):
            updater.replace_service_image("services:\n  app:\n    image: ${IMAGE}\n", "app", "sentinel-ops:1.3.0")

    def test_only_existing_database_inside_volume_is_accepted(self):
        with tempfile.TemporaryDirectory() as temp:
            root = Path(temp)
            db = root / "sentinel.db"
            db.write_bytes(b"old db")
            self.assertEqual(updater.effective_database_file({}, root), db)
            self.assertEqual(updater.effective_database_file({"environment": {"DATABASE_PATH": "./data/sentinel.db"}}, root), db)
            with self.assertRaisesRegex(RuntimeError, "not inside"):
                updater.effective_database_file({"environment": {"DATABASE_PATH": "/var/data/sentinel.db"}}, root)
            with self.assertRaisesRegex(RuntimeError, "new empty"):
                updater.effective_database_file({"environment": {"DATABASE_PATH": "/app/data/new.db"}}, root)

    def test_selected_service_must_have_original_bind_mount(self):
        with tempfile.TemporaryDirectory() as temp:
            compose = Path(temp) / "compose.yaml"
            compose.write_text("services: {}\n")
            config = {"services": {
                "app": {"image": "sentinel-ops:1.2.0",
                        "volumes": [{"type": "bind", "source": temp, "target": "/app/data"}]},
                "other": {"image": "busybox", "volumes": []},
            }}
            with patch.object(updater, "compose_call", return_value=json.dumps(config)):
                name, image, _ = updater.service_from_config(compose, Path(temp).resolve())
            self.assertEqual((name, image), ("app", "sentinel-ops:1.2.0"))
            config["services"]["app"]["volumes"][0]["source"] = "/wrong/data"
            with patch.object(updater, "compose_call", return_value=json.dumps(config)):
                with self.assertRaisesRegex(RuntimeError, "exactly one"):
                    updater.service_from_config(compose, Path(temp).resolve())

    def test_checksum_must_match_actual_tar_file(self):
        with tempfile.TemporaryDirectory() as temp:
            tar = Path(temp) / "sentinel-ops-1.3.0.tar"
            tar.write_bytes(b"offline-image")
            checksum = hashlib.sha256(b"offline-image").hexdigest()
            Path(str(tar) + ".sha256").write_text(checksum + "  " + tar.name + "\n")
            self.assertEqual(updater.verified_image_file(tar), "sentinel-ops:1.3.0")
            tar.write_bytes(b"corrupted")
            with self.assertRaisesRegex(RuntimeError, "checksum mismatch"):
                updater.verified_image_file(tar)


if __name__ == "__main__":
    unittest.main()
