import { FunctionComponent, useState, useRef, useEffect } from 'react';
import { Button } from '../components/ui/button';
import { Textarea } from '../components/ui/textarea';
import { ScrollArea } from '../components/ui/scroll-area';
import { Bot, User, Loader2 } from 'lucide-react';
import { supabase } from '../integrations/supabase/client';

interface Message {
  role: 'user' | 'assistant';
  content: string;
}

interface AiChatProps {
  onMidiPatternGenerated: (pattern: any) => Promise<void>;
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
      const { data, error } = await supabase.functions.invoke('gemini-chat', {
        body: { prompt: input },
      });

      if (error) {
        throw error;
      }
      
      let assistantContent = data.response;

      const midiRegex = /\[WEBDAW_MIDI\]([\s\S]*?)\[\/WEBDAW_MIDI\]/;
      const midiMatch = assistantContent.match(midiRegex);

      if (midiMatch && midiMatch[1]) {
        try {
          const midiJsonString = midiMatch[1];
          const midiData = JSON.parse(midiJsonString);
          
          if (midiData.type === 'midi_patterns' && Array.isArray(midiData.patterns)) {
            for (const pattern of midiData.patterns) {
              await onMidiPatternGenerated(pattern);
            }
          }
          
          assistantContent = assistantContent.replace(midiRegex, '').trim();
        } catch (jsonError) {
          console.error("Failed to parse MIDI JSON from AI response:", jsonError);
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
    <div className="flex flex-col h-full">
      <p className="text-muted-foreground text-sm mb-4">
        Your creative partner for making music. Ask for ideas, instruments, or feedback.
      </p>
      <ScrollArea className="flex-grow mb-4 pr-4" ref={scrollAreaRef}>
        <div className="space-y-4">
          {messages.map((message, index) => (
            <div key={index} className={`flex items-start gap-3 ${message.role === 'user' ? 'justify-end' : ''}`}>
              {message.role === 'assistant' && <Bot className="h-6 w-6 flex-shrink-0 text-yellow-400" />}
              <div className={`rounded-lg px-3 py-2 text-sm ${message.role === 'user' ? 'bg-blue-600 text-white' : 'bg-muted'}`}>
                <p className="whitespace-pre-wrap">{message.content}</p>
              </div>
              {message.role === 'user' && <User className="h-6 w-6 flex-shrink-0" />}
            </div>
          ))}
          {isLoading && (
             <div className="flex items-start gap-3">
                <Bot className="h-6 w-6 flex-shrink-0 text-yellow-400" />
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
          placeholder="Create a funky bassline..."
          className="flex-grow bg-background/80"
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