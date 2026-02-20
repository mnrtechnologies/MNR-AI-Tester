import { useEffect, useState, useRef } from "react";
import { api } from "../../../services/api";
import { Send, Bot, User } from 'lucide-react';

export default function ChatPanel({ testId, status }) {
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");
  const [waitingField, setWaitingField] = useState(null);
  const messagesEndRef = useRef(null);
  const lastProcessedIdRef = useRef(null); // Fix for duplicate messages

  // Auto-scroll to bottom
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  useEffect(() => {
    if (!testId || status === "completed") return;

    const poll = setInterval(async () => {
      try {
        const data = await api.checkWaiting(testId);
        
        // Only update if we have a new waiting field we haven't seen yet
        if (data.waiting && data.payload) {
          if (lastProcessedIdRef.current !== data.payload.element_id) {
            lastProcessedIdRef.current = data.payload.element_id;
            
            setWaitingField(data.payload);
            setMessages(prev => [
              ...prev, 
              { 
                from: "bot", 
                text: `Please enter value for: ${data.payload.field_label || "Field"}` 
              }
            ]);
          }
        }
      } catch (e) { console.error(e); }
    }, 1000);

    return () => clearInterval(poll);
  }, [testId, status]);

  const sendInput = async () => {
    if (!input.trim() || !waitingField) return;
    
    const currentInput = input;
    setInput(""); // Clear immediately for UX
    setWaitingField(null);
    lastProcessedIdRef.current = null; // Reset for next field

    // Optimistic UI update
    setMessages(prev => [...prev, { from: "user", text: currentInput }]);

    try {
      await api.sendInput(testId, waitingField.element_id, currentInput);
    } catch (e) {
      console.error("Failed to send input", e);
      setMessages(prev => [...prev, { from: "bot", text: "Error sending input. Please try again." }]);
    }
  };

  return (
    <div className="flex flex-col h-full bg-slate-900 rounded-xl shadow-lg border border-slate-800 overflow-hidden">
      <div className="bg-slate-950 px-4 py-3 border-b border-slate-800 flex items-center justify-between">
        <h3 className="text-sm font-bold text-slate-200 flex items-center gap-2">
          <Bot size={16} className="text-indigo-400"/> Assistant
        </h3>
        {status === 'running' && (
           <span className="flex h-2 w-2 rounded-full bg-indigo-500 animate-pulse"/>
        )}
      </div>

      <div className="flex-1 p-4 overflow-y-auto space-y-4 bg-slate-900/50 custom-scrollbar">
        {messages.length === 0 && (
          <div className="flex flex-col items-center justify-center h-full text-slate-500 space-y-2 opacity-60">
            <Bot size={40} strokeWidth={1.5} />
            <p className="text-xs">Agent is running. Requests will appear here.</p>
          </div>
        )}
        
        {messages.map((m, i) => (
          <div key={i} className={`flex gap-3 ${m.from === "user" ? "flex-row-reverse" : "flex-row"}`}>
            <div className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 ${
              m.from === "user" ? "bg-indigo-600" : "bg-slate-700"
            }`}>
              {m.from === "user" ? <User size={14} className="text-white"/> : <Bot size={14} className="text-indigo-300"/>}
            </div>
            
            <div className={`max-w-[80%] px-4 py-2.5 text-sm rounded-2xl ${
              m.from === "user" 
                ? "bg-indigo-600 text-white rounded-tr-none" 
                : "bg-slate-800 border border-slate-700 text-slate-200 rounded-tl-none"
            }`}>
              {m.text}
            </div>
          </div>
        ))}
        <div ref={messagesEndRef} />
      </div>

      <div className="p-3 bg-slate-950 border-t border-slate-800">
        <div className="relative">
          <input
            value={input}
            onChange={e => setInput(e.target.value)}
            disabled={!waitingField}
            placeholder={waitingField ? `Enter ${waitingField.field_label}...` : "Waiting for agent request..."}
            className="w-full pl-4 pr-12 py-3 bg-slate-900 border border-slate-700 rounded-xl text-sm text-white placeholder:text-slate-500 focus:ring-2 focus:ring-indigo-500/50 focus:border-indigo-500 outline-none transition-all disabled:opacity-50 disabled:cursor-not-allowed"
            onKeyDown={(e) => e.key === 'Enter' && sendInput()}
          />
          <button 
            onClick={sendInput}
            disabled={!input.trim() || !waitingField}
            className="absolute right-2 top-2 p-1.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg transition-colors disabled:opacity-0 disabled:pointer-events-none"
          >
            <Send size={16} />
          </button>
        </div>
      </div>
    </div>
  );
}