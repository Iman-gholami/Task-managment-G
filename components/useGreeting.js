"use client";

import { useEffect, useState } from "react";

/**
 * Time-of-day greeting with the viewer's first name ("Good morning, Sara").
 * Empty until mounted, so the server and the first client render match; the eyebrow keeps its height.
 */
export default function useGreeting(name = "") {
  const [text, setText] = useState("");
  useEffect(() => {
    const h = new Date().getHours();
    const part = h >= 5 && h < 12 ? "Good morning" : h >= 12 && h < 17 ? "Good afternoon" : "Good evening";
    const first = name.split(" ")[0];
    setText(first ? `${part}, ${first}` : part);
  }, [name]);
  return text;
}
