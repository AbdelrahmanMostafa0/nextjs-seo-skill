"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

export function Feed() {
  const [posts, setPosts] = useState([]);
  const router = useRouter();
  useEffect(() => {
    fetch("/api/posts").then((r) => r.json()).then(setPosts);
  }, []);
  return <div onClick={() => router.push("/blog")}>{posts.length}</div>;
}
