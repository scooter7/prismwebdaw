import { FunctionComponent, useState, useRef, useEffect } from 'react';
import { Button } from '../components/ui/button';
import { Textarea } from '../components/ui/textarea';
import { ScrollArea } from '../components/ui/scroll-area';
import { Bot, User, Loader2 } from 'lucide-react';

interface Message {
  role: 'user' | 'assistant';
  content: string;
}

interface AiChatProps {
  onMidiPatternGenerated: (pattern: any) => void;
}

export const AiChat: FunctionComponent<AiChatProps> = ({ onMidiPatternGenerated }) => {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const scrollAreaRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scrollAreaRef.current) {
      scrollAreaRef.current.scrollTop = scrollAreaRef.current.scrollHeight;
    }
  }, [messages]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || isLoading) return;

    const userMessage: Message = { role: 'user', content: input };
    setMessages((prev) => [...prev, userMessage]);
    setInput('');
    setIsLoading(true);

    try {
      const SUPABASE_URL = "https://yezjxwahexsfbvhfxsji.supabase.co";
      const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inllemp4d2FoZXhzZmJ2aGZ4c2ppIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTI2OTIyOTAsImV4cCI6MjA2ODI2ODI5MH0.8DH3ggR-jbKVRfZhHfHltk1TPCt30e4eqB4zw2l6w3Y";
      const functionUrl = `${SUPABASE_URL}/functions/v1/gemini-chat`;

      const response = await fetch(functionUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'apikey': SUPABASE_ANON_KEY,
          'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
        },
        body: JSON.stringify({ prompt: input }),
      });

      if (!response.ok) {
        const errorBody = await response.text();
        throw new Error(`Request failed with status ${response.status}: ${errorBody}`);
      }
      
      const data = await response.json();
      let assistantContent = data.response;

      // Check for the special MIDI block
      const midiRegex = /\[WEBDAW_MIDI\]([\s\S]*?)\[\/WEBDAW_MIDI\]/;
      const midiMatch = assistantContent.match(midiRegex);

      if (midiMatch && midiMatch[1]) {
        try {
          const midiJsonString = midiMatch[1];
          const midiPattern = JSON.parse(midiJsonString);
          onMidiPatternGenerated(midiPattern);
          
          // Remove the block from the displayed message
          assistantContent = assistantContent.replace(midiRegex, '').trim();
        } catch (jsonError) {
          console.error("Failed to parse MIDI JSON from AI response:", jsonError);
          // Don't block the text response from showing
        }
      }
      
      const assistantMessage: Message = { role: 'assistant', content: assistantContent };
      setMessages((prev) => [...prev, assistantMessage]);

    } catch (err: any) {
      const errorMessage: Message = { role: 'assistant', content: `Sorry, I encountered an error: ${err.message}` };
      setMessages((prev) => [...prev, errorMessage]);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="flex flex-col h-full pt-4">
      <ScrollArea className="flex-grow mb-4 pr-4" ref={scrollAreaRef}>
        <div className="space-y-4">
          {messages.map((message, index) => (
            <div key={index} className={`flex items-start gap-3 ${message.role === 'user' ? 'justify-end' : ''}`}>
              {message.role === 'assistant' && <Bot className="h-6 w-6 flex-shrink-0" />}
              <div className={`rounded-lg px-3 py-2 ${message.role === 'user' ? 'bg-primary text-primary-foreground' : 'bg-muted'}`}>
                <p className="text-sm whitespace-pre-wrap">{message.content}</p>
              </div>
              {message.role === 'user' && <User className="h-6 w-6 flex-shrink-0" />}
            </div>
          ))}
          {isLoading && (
             <div className="flex items-start gap-3">
                <Bot className="h-6 w-6 flex-shrink-0" />
                <div className="rounded-lg px-3 py-2 bg-muted flex items-center">
                    <Loader2 className="h-5 w-5 animate-spin" />
                </div>
             </div>
          )}
        </div>
      </ScrollArea>
      <form onSubmit={handleSubmit} className="flex items-center gap-2">
        <Textarea
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Ask for a funky bassline in C minor..."
          className="flex-grow"
          disabled={isLoading}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault();
              handleSubmit(e);
            }
          }}
        />
        <Button type="submit" disabled={isLoading}>
          Send
        </Button>
      </form>
    </div>
  );
};