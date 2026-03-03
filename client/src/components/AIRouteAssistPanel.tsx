import { useState, useCallback, useRef, useEffect } from 'react';
import { X, Send, Sparkles, Loader2, ChevronDown, ChevronUp, MapPin } from 'lucide-react';

type ActivityType = 'hiking' | 'trail_running' | 'downhill_ski' | 'xc_ski' | 'mtb';

interface RouteOption {
  name: string;
  description: string;
  distance_miles: number;
  elevation_gain_ft: number;
  difficulty: string;
  waypoints: Array<{ lat: number; lng: number; name?: string }>;
  source: 'trail_data' | 'community';
}

interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
  routeOptions?: RouteOption[];
}

interface AIRouteAssistPanelProps {
  isOpen: boolean;
  onClose: () => void;
  mapCenter: { lat: number; lng: number } | null;
  mapZoom: number;
  onAddWaypoints: (waypoints: Array<{ lat: number; lng: number; name?: string }>, routeName: string) => void;
  existingRoute?: Array<{ lat: number; lng: number }>;
}

const ACTIVITY_OPTIONS: { value: ActivityType; label: string }[] = [
  { value: 'hiking', label: 'Hiking' },
  { value: 'trail_running', label: 'Trail Running' },
  { value: 'downhill_ski', label: 'Downhill Ski' },
  { value: 'xc_ski', label: 'XC Ski' },
  { value: 'mtb', label: 'Mountain Bike' },
];

const STARTER_SUGGESTIONS = [
  "Find me a moderate loop hike nearby",
  "What trails are in this area?",
  "Suggest a beginner-friendly route",
  "Plan a challenging all-day hike",
];

export default function AIRouteAssistPanel({ isOpen, onClose, mapCenter, mapZoom, onAddWaypoints, existingRoute }: AIRouteAssistPanelProps) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [activityType, setActivityType] = useState<ActivityType>('hiking');
  const [expandedOptions, setExpandedOptions] = useState<Set<number>>(new Set());
  const [conversationHistory, setConversationHistory] = useState<Array<{ role: 'user' | 'assistant'; content: string }>>([]);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  useEffect(() => {
    if (isOpen) {
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  }, [isOpen]);

  const parseRouteOptions = (text: string): RouteOption[] => {
    const options: RouteOption[] = [];
    const regex = /```route_option\s*\n([\s\S]*?)```/g;
    let match;
    while ((match = regex.exec(text)) !== null) {
      try {
        const parsed = JSON.parse(match[1]);
        if (parsed.waypoints && Array.isArray(parsed.waypoints)) {
          options.push(parsed);
        }
      } catch { /* skip invalid */ }
    }
    return options;
  };

  const cleanResponseText = (text: string): string => {
    return text.replace(/```route_option\s*\n[\s\S]*?```/g, '').trim();
  };

  const sendMessage = useCallback(async (messageText: string) => {
    if (!messageText.trim() || isLoading || !mapCenter) return;

    const userMessage: ChatMessage = { role: 'user', content: messageText.trim() };
    setMessages(prev => [...prev, userMessage]);
    setInput('');
    setIsLoading(true);

    const newHistory = [...conversationHistory, { role: 'user' as const, content: messageText.trim() }];

    try {
      const response = await fetch('/api/ai/route-assist', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          message: messageText.trim(),
          mapCenter: { lat: mapCenter.lat, lng: mapCenter.lng },
          mapZoom: mapZoom,
          activityType,
          conversationHistory,
          existingRoute: existingRoute?.map(p => ({ lat: p.lat, lng: p.lng })),
        }),
      });

      const data = await response.json();

      if (data.message && !data.response) {
        const assistantMessage: ChatMessage = { role: 'assistant', content: data.message };
        setMessages(prev => [...prev, assistantMessage]);
        setConversationHistory([...newHistory, { role: 'assistant', content: data.message }]);
      } else {
        const responseText = data.response || data.message || 'No response received.';
        const routeOptions = parseRouteOptions(responseText);
        const cleanText = cleanResponseText(responseText);

        const assistantMessage: ChatMessage = {
          role: 'assistant',
          content: cleanText,
          routeOptions: routeOptions.length > 0 ? routeOptions : undefined,
        };
        setMessages(prev => [...prev, assistantMessage]);
        setConversationHistory([...newHistory, { role: 'assistant', content: responseText }]);
      }
    } catch (err) {
      const errorMessage: ChatMessage = {
        role: 'assistant',
        content: 'Sorry, something went wrong. Please try again.',
      };
      setMessages(prev => [...prev, errorMessage]);
    } finally {
      setIsLoading(false);
    }
  }, [isLoading, mapCenter, mapZoom, activityType, conversationHistory, existingRoute]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    sendMessage(input);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage(input);
    }
  };

  const toggleExpanded = (index: number) => {
    setExpandedOptions(prev => {
      const next = new Set(prev);
      if (next.has(index)) next.delete(index);
      else next.add(index);
      return next;
    });
  };

  if (!isOpen) return null;

  return (
    <div className="flex flex-col bg-gray-900/95 backdrop-blur-sm border border-white/10 rounded-xl shadow-2xl w-[340px] sm:w-[380px] max-h-[70vh] overflow-hidden">
      <div className="flex items-center justify-between px-4 py-3 border-b border-white/10 bg-gradient-to-r from-yellow-900/30 to-amber-900/30">
        <div className="flex items-center gap-2">
          <Sparkles className="w-5 h-5 text-yellow-400" />
          <h3 className="text-white font-semibold text-sm">AI Route Assistant</h3>
        </div>
        <button onClick={onClose} className="text-white/60 hover:text-white p-1 rounded transition-colors">
          <X className="w-4 h-4" />
        </button>
      </div>

      <div className="px-3 py-2 border-b border-white/10 flex gap-1.5 flex-wrap">
        {ACTIVITY_OPTIONS.map(opt => (
          <button
            key={opt.value}
            onClick={() => setActivityType(opt.value)}
            className={`px-2.5 py-1 rounded-full text-xs font-medium transition-colors ${
              activityType === opt.value
                ? 'bg-yellow-500/30 text-yellow-300 border border-yellow-500/50'
                : 'bg-white/5 text-white/60 border border-white/10 hover:bg-white/10'
            }`}
          >
            {opt.label}
          </button>
        ))}
      </div>

      <div className="flex-1 overflow-y-auto px-3 py-3 space-y-3 min-h-[200px]">
        {messages.length === 0 && (
          <div className="space-y-3">
            <p className="text-white/50 text-xs text-center pt-2">Ask me about routes and trails in this area</p>
            <div className="grid grid-cols-1 gap-1.5">
              {STARTER_SUGGESTIONS.map((suggestion, i) => (
                <button
                  key={i}
                  onClick={() => sendMessage(suggestion)}
                  className="text-left px-3 py-2 rounded-lg bg-white/5 border border-white/10 text-white/70 text-xs hover:bg-white/10 hover:text-white transition-colors"
                >
                  {suggestion}
                </button>
              ))}
            </div>
          </div>
        )}

        {messages.map((msg, i) => (
          <div key={i} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
            <div className={`max-w-[90%] rounded-lg px-3 py-2 text-sm ${
              msg.role === 'user'
                ? 'bg-blue-600/80 text-white'
                : 'bg-white/10 text-white/90'
            }`}>
              <p className="whitespace-pre-wrap text-xs leading-relaxed">{msg.content}</p>

              {msg.routeOptions && msg.routeOptions.length > 0 && (
                <div className="mt-2 space-y-2">
                  <p className="text-[10px] text-white/50 uppercase tracking-wide font-semibold">
                    {msg.routeOptions.length} route option{msg.routeOptions.length !== 1 ? 's' : ''}
                  </p>
                  {msg.routeOptions.map((option, j) => {
                    const globalIdx = i * 100 + j;
                    const isExpanded = expandedOptions.has(globalIdx);
                    const borderColor = option.source === 'community' ? 'border-purple-500/50' : 'border-blue-500/50';
                    const badgeColor = option.source === 'community' ? 'bg-purple-500/20 text-purple-300' : 'bg-blue-500/20 text-blue-300';
                    const badgeText = option.source === 'community' ? 'Community' : 'Trail Data';

                    return (
                      <div key={j} className={`border ${borderColor} rounded-lg p-2 bg-black/20`}>
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-1.5 mb-1">
                              <span className={`text-[9px] px-1.5 py-0.5 rounded-full ${badgeColor}`}>{badgeText}</span>
                            </div>
                            <p className="text-white font-medium text-xs truncate">{option.name}</p>
                            <p className="text-white/50 text-[10px] mt-0.5">{option.description}</p>
                          </div>
                        </div>
                        <div className="flex items-center gap-3 mt-1.5 text-[10px] text-white/60">
                          <span>{option.distance_miles?.toFixed(1)} mi</span>
                          <span>{option.elevation_gain_ft?.toLocaleString()} ft gain</span>
                          <span className="capitalize">{option.difficulty}</span>
                        </div>

                        <button
                          onClick={() => toggleExpanded(globalIdx)}
                          className="flex items-center gap-1 mt-1.5 text-[10px] text-white/40 hover:text-white/70"
                        >
                          {isExpanded ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                          {option.waypoints.length} waypoints
                        </button>

                        {isExpanded && (
                          <div className="mt-1 max-h-24 overflow-y-auto space-y-0.5">
                            {option.waypoints.map((wp, k) => (
                              <div key={k} className="flex items-center gap-1 text-[9px] text-white/40">
                                <MapPin className="w-2.5 h-2.5 flex-shrink-0" />
                                <span className="truncate">{wp.name || `${wp.lat.toFixed(5)}, ${wp.lng.toFixed(5)}`}</span>
                              </div>
                            ))}
                          </div>
                        )}

                        <button
                          onClick={() => onAddWaypoints(option.waypoints, option.name)}
                          className="w-full mt-2 px-2 py-1.5 rounded-md bg-green-600/80 hover:bg-green-600 text-white text-xs font-medium transition-colors"
                        >
                          Add This Route to Map
                        </button>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        ))}

        {isLoading && (
          <div className="flex justify-start">
            <div className="bg-white/10 rounded-lg px-3 py-2 flex items-center gap-2">
              <Loader2 className="w-4 h-4 text-yellow-400 animate-spin" />
              <span className="text-white/60 text-xs">Thinking...</span>
            </div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      <form onSubmit={handleSubmit} className="border-t border-white/10 p-3 flex gap-2">
        <textarea
          ref={inputRef}
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Ask about routes in this area..."
          className="flex-1 bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-white text-xs placeholder:text-white/30 resize-none focus:outline-none focus:ring-1 focus:ring-yellow-500/50"
          rows={2}
          disabled={isLoading}
        />
        <button
          type="submit"
          disabled={isLoading || !input.trim()}
          className="self-end px-3 py-2 bg-yellow-600/80 hover:bg-yellow-600 disabled:opacity-40 disabled:cursor-not-allowed rounded-lg text-white transition-colors"
        >
          <Send className="w-4 h-4" />
        </button>
      </form>
    </div>
  );
}
