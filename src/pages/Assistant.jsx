import { useState, useEffect, useRef } from "react";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Send, Bot, MessageSquare, Smartphone } from "lucide-react";
import MessageBubble from "../components/assistant/MessageBubble";

const AGENT_NAME = "estoque_assistant";

export default function Assistant() {
  const [conversation, setConversation] = useState(null);
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [starting, setStarting] = useState(true);
  const bottomRef = useRef(null);

  useEffect(() => {
    startConversation();
  }, []);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const startConversation = async () => {
    setStarting(true);
    const conv = await base44.agents.createConversation({
      agent_name: AGENT_NAME,
      metadata: { name: "Chat de Estoque" },
    });
    setConversation(conv);
    setMessages(conv.messages || []);
    setStarting(false);

    base44.agents.subscribeToConversation(conv.id, (data) => {
      setMessages([...(data.messages || [])]);
    });
  };

  const handleSend = async () => {
    if (!input.trim() || loading || !conversation) return;
    const text = input.trim();
    setInput("");
    setLoading(true);
    await base44.agents.addMessage(conversation, { role: "user", content: text });
    setLoading(false);
  };

  const handleKeyDown = (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const whatsappUrl = base44.agents.getWhatsAppConnectURL(AGENT_NAME);

  return (
    <div className="flex flex-col h-[calc(100vh-120px)] max-w-3xl mx-auto">
      {/* Header */}
      <div className="bg-white rounded-t-xl border border-b-0 border-gray-100 px-5 py-4 flex items-center justify-between shadow-sm">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-green-100 flex items-center justify-center">
            <Bot className="w-5 h-5 text-green-700" />
          </div>
          <div>
            <p className="text-sm font-semibold text-gray-800">Assistente de Estoque</p>
            <p className="text-xs text-gray-400">Registre movimentações e consulte o estoque por chat</p>
          </div>
        </div>
        <a
          href={whatsappUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-2 bg-green-500 hover:bg-green-600 text-white text-xs font-medium px-3 py-2 rounded-lg transition-colors"
        >
          <Smartphone className="w-3.5 h-3.5" />
          WhatsApp
        </a>
      </div>

      {/* Messages */}
      <div className="flex-1 bg-white border border-gray-100 overflow-y-auto px-4 py-5 space-y-4">
        {starting ? (
          <div className="flex items-center justify-center h-full text-gray-400 text-sm gap-2">
            <div className="w-4 h-4 border-2 border-green-500 border-t-transparent rounded-full animate-spin" />
            Iniciando conversa...
          </div>
        ) : messages.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full gap-3 text-center">
            <MessageSquare className="w-10 h-10 text-gray-200" />
            <p className="text-gray-400 text-sm">Nenhuma mensagem ainda.<br />Comece perguntando sobre o estoque ou registrando uma movimentação.</p>
            <div className="flex flex-col gap-2 mt-2 w-full max-w-xs">
              {[
                "Qual o estoque atual de mudas?",
                "Registrar entrada: 50 kg de fertilizante",
                "Quais produtos estão abaixo do mínimo?",
              ].map((suggestion) => (
                <button
                  key={suggestion}
                  onClick={() => setInput(suggestion)}
                  className="text-xs bg-gray-50 hover:bg-green-50 text-gray-600 hover:text-green-700 border border-gray-100 hover:border-green-200 px-3 py-2 rounded-lg transition-all text-left"
                >
                  {suggestion}
                </button>
              ))}
            </div>
          </div>
        ) : (
          messages.map((msg, i) => <MessageBubble key={i} message={msg} />)
        )}
        {loading && (
          <div className="flex gap-3">
            <div className="h-7 w-7 rounded-lg bg-green-100 flex items-center justify-center">
              <Bot className="w-4 h-4 text-green-700" />
            </div>
            <div className="bg-white border border-gray-200 rounded-2xl px-4 py-3 flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: "0ms" }} />
              <span className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: "150ms" }} />
              <span className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: "300ms" }} />
            </div>
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      {/* Input */}
      <div className="bg-white rounded-b-xl border border-t border-gray-100 px-4 py-3 flex gap-2 shadow-sm">
        <Input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Ex: Registrar saída de 10 mudas para o Projeto Verde..."
          className="flex-1 text-sm"
          disabled={loading || starting}
        />
        <Button
          onClick={handleSend}
          disabled={!input.trim() || loading || starting}
          className="bg-green-700 hover:bg-green-800 text-white"
          size="icon"
        >
          <Send className="w-4 h-4" />
        </Button>
      </div>
    </div>
  );
}