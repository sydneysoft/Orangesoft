"use client";

import { useEffect, useRef, useState } from "react";
import "./v2.css";

const MEMORY_KEY = "blueprint.zaika.memory";
const RESPONSE_KEY = "blueprint.v2.response";
const CHAT_KEY = "blueprint.v2.chat";
const ACCESS_KEY = "blueprint.key";

function readStoredChat() {
  try {
    const value = JSON.parse(localStorage.getItem(CHAT_KEY) || "[]");
    return Array.isArray(value) ? value.slice(-40) : [];
  } catch {
    return [];
  }
}

function readFile(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve({ name: file.name, type: file.type || "application/octet-stream", data: String(reader.result || "") });
    reader.onerror = () => reject(reader.error || new Error("Could not read file"));
    reader.readAsDataURL(file);
  });
}

function renderText(text) {
  const value = String(text || "");
  const parts = value.split(/(https?:\/\/[^\s]+)/g);
  return parts.map((part, index) =>
    /^https?:\/\//.test(part) ? (
      <a key={index} href={part} target="_blank" rel="noreferrer">{part}</a>
    ) : (
      <span key={index}>{part}</span>
    )
  );
}

export default function BlueprintV2() {
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [key, setKey] = useState("");
  const [attachments, setAttachments] = useState([]);
  const fileRef = useRef(null);
  const endRef = useRef(null);

  useEffect(() => {
    setMessages(readStoredChat());
    setKey(sessionStorage.getItem(ACCESS_KEY) || "");
  }, []);

  useEffect(() => {
    localStorage.setItem(CHAT_KEY, JSON.stringify(messages.slice(-40)));
    endRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [messages]);

  function setAccessKey() {
    const next = window.prompt("V2 access key:", key);
    if (next === null) return;
    const clean = next.trim();
    setKey(clean);
    if (clean) sessionStorage.setItem(ACCESS_KEY, clean);
    else sessionStorage.removeItem(ACCESS_KEY);
  }

  function clearChat() {
    setMessages([]);
    setAttachments([]);
    localStorage.removeItem(CHAT_KEY);
    sessionStorage.removeItem(RESPONSE_KEY);
  }

  async function addFiles(event) {
    const files = Array.from(event.target.files || []).slice(0, 4);
    event.target.value = "";
    if (!files.length) return;
    const tooLarge = files.find((file) => file.size > 5_000_000);
    if (tooLarge) {
      window.alert(`${tooLarge.name} is too large. Keep each file under 5 MB.`);
      return;
    }
    try {
      const loaded = await Promise.all(files.map(readFile));
      setAttachments((current) => [...current, ...loaded].slice(0, 4));
    } catch {
      window.alert("Could not read that file.");
    }
  }

  async function send() {
    const text = input.trim();
    if ((!text && !attachments.length) || busy) return;
    if (!key) {
      setAccessKey();
      return;
    }

    const localAttachments = attachments;
    const userMessage = {
      id: `${Date.now()}-u`,
      role: "user",
      text: text || "Sent attachment(s)",
      files: localAttachments.map((item) => item.name),
    };

    setMessages((current) => [...current, userMessage]);
    setInput("");
    setAttachments([]);
    setBusy(true);

    try {
      const response = await fetch("/api/v2", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "x-blueprint-key": key,
        },
        body: JSON.stringify({
          message: text,
          attachments: localAttachments,
          previous_response_id: sessionStorage.getItem(RESPONSE_KEY) || "",
          memory: localStorage.getItem(MEMORY_KEY) || "",
        }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok || !data?.ok) throw new Error(data?.error || `Request failed (${response.status})`);
      if (data.response_id) sessionStorage.setItem(RESPONSE_KEY, data.response_id);

      setMessages((current) => [
        ...current,
        {
          id: `${Date.now()}-a`,
          role: "assistant",
          text: data.output || "Done.",
          images: [...(data.images || []), ...(data.code_images || [])],
        },
      ]);
    } catch (error) {
      if (String(error?.message || "").toLowerCase().includes("access key")) {
        sessionStorage.removeItem(ACCESS_KEY);
        setKey("");
      }
      setMessages((current) => [
        ...current,
        { id: `${Date.now()}-e`, role: "assistant", error: true, text: error instanceof Error ? error.message : String(error) },
      ]);
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="v2Chat">
      <header className="v2Topbar">
        <div className="v2Brand">
          <span className="v2Mark">+</span>
          <div>
            <strong>BLUEPRINT V2</strong>
            <small>PRIVATE WORKSPACE</small>
          </div>
        </div>
        <div className="v2Actions">
          <button onClick={() => fileRef.current?.click()}>ATTACH</button>
          <button onClick={setAccessKey}>{key ? "KEY ✓" : "KEY"}</button>
          <button onClick={clearChat}>NEW CHAT</button>
        </div>
        <input ref={fileRef} className="v2FileInput" type="file" multiple onChange={addFiles} />
      </header>

      <section className="v2Conversation">
        {!messages.length && (
          <div className="v2Empty">
            <div className="v2EmptyMark">V2</div>
            <h1>What do you want to do?</h1>
            <p>Ask normally. V2 chooses the tools it needs.</p>
            <div className="v2Examples">
              <button onClick={() => setInput("Update my OrangeSoft website based on my instructions.")}>Update a website</button>
              <button onClick={() => setInput("Search the web and compare the best options for me.")}>Research something</button>
              <button onClick={() => setInput("Create an image from my description.")}>Create an image</button>
              <button onClick={() => setInput("Analyze the file I attach and tell me what matters.")}>Analyze a file</button>
            </div>
          </div>
        )}

        <div className="v2Messages">
          {messages.map((message) => (
            <article key={message.id} className={`v2Message ${message.role === "user" ? "isUser" : "isAssistant"} ${message.error ? "isError" : ""}`}>
              <div className="v2Who">{message.role === "user" ? "YOU" : "V2"}</div>
              <div className="v2Bubble">
                <div className="v2Text">{renderText(message.text)}</div>
                {message.files?.length > 0 && (
                  <div className="v2Files">{message.files.map((name) => <span key={name}>{name}</span>)}</div>
                )}
                {message.images?.length > 0 && (
                  <div className="v2Images">
                    {message.images.map((src, index) => <img key={index} src={src} alt={`Generated result ${index + 1}`} />)}
                  </div>
                )}
              </div>
            </article>
          ))}
          {busy && (
            <article className="v2Message isAssistant">
              <div className="v2Who">V2</div>
              <div className="v2Bubble v2Thinking"><span></span><span></span><span></span></div>
            </article>
          )}
          <div ref={endRef} />
        </div>
      </section>

      <footer className="v2ComposerWrap">
        {attachments.length > 0 && (
          <div className="v2AttachmentBar">
            {attachments.map((item, index) => (
              <button key={`${item.name}-${index}`} onClick={() => setAttachments((current) => current.filter((_, i) => i !== index))}>
                {item.name} ×
              </button>
            ))}
          </div>
        )}
        <div className="v2Composer">
          <button className="v2Plus" onClick={() => fileRef.current?.click()} aria-label="Attach file">+</button>
          <textarea
            value={input}
            onChange={(event) => setInput(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter" && !event.shiftKey) {
                event.preventDefault();
                send();
              }
            }}
            placeholder="Message V2"
            rows={1}
          />
          <button className="v2Send" onClick={send} disabled={busy || (!input.trim() && !attachments.length)} aria-label="Send">↑</button>
        </div>
        <div className="v2Hint">Enter to send · Shift+Enter for a new line</div>
      </footer>
    </main>
  );
}
