import { FunctionComponent, useState, useRef, useEffect } from 'react';
import { Button } from '../components/ui/button';
import { Textarea } from '../components/ui/textarea';
import { ScrollArea } from '../components/ui/scroll-area';
import { Bot, User, Loader2, Music, BrainCircuit } from 'lucide-react';
import { supabase } from '../integrations/supabase/client';
import { cn } from '../lib/utils';
import { useAuth } from '../auth/AuthContext';

interface Message {
  role: 'user' | 'assistant';
  content: string;
}

interface AiChatProps {
  onMidiPatternGenerated: (pattern: any) => Promise<void>;
}

export const AiChat: FunctionComponent<AiChatProps> = ({ onMidiPatternGenerated }) => {
  const [mode, setMode] = useState<'create' | 'learn'>('create');
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const scrollAreaRef = useRef<HTMLDivElement>(null);
  const { session } = useAuth();

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
    const currentInput = input;
    setInput('');
    setIsLoading(true);

    setMessages((prev) => [...prev, { role: 'assistant', content: '' }]);

    try {
      if (mode === 'create') {
        console.log("AiChat: Sending 'create' prompt to gemini-chat function.");
        const { data, error } = await supabase.functions.invoke('gemini-chat', {
          body: { prompt: currentInput },
        });

        if (error) throw error;
        
        let assistantContent = data.response;
        const midiRegex = /\[WEBDAW_MIDI\]([\s\S]*?)\[\/WEBDAW_MIDI\]/;
        const midiMatch = assistantContent.match(midiRegex);

        if (midiMatch && midiMatch[1]) {
          try {
            const cleanedJsonString = midiMatch[1].replace(/```json/g, '').replace(/```/g, '').trim();
            const midiData = JSON.parse(cleanedJsonString);
            
            if (midiData.type === 'midi_patterns' && Array.isArray(midiData.patterns)) {
              for (const pattern of midiData.patterns) {
                await onMidiPatternGenerated(pattern);
              }
            }
            
            assistantContent = assistantContent.replace(midiRegex, '').trim();
          } catch (jsonError) {
            console.error("AiChat: Failed to parse MIDI JSON from AI response:", jsonError);
          }
        }
        
        setMessages(prev => {
          const newMessages = [...prev];
          newMessages[newMessages.length - 1].content = assistantContent;
          return newMessages;
        });
      } else { // Learn mode with non-streaming for debugging
        console.log("AiChat: Learn mode activated. Checking session.");
        if (!session) {
          setMessages(prev => {
            const newMessages = [...prev];
            newMessages[newMessages.length - 1].content = 'Please log in to use the Learn feature.';
            return newMessages;
          });
          setIsLoading(false);
          console.log("AiChat: Session is null, returning.");
          return;
        }

        console.log("AiChat: Session is active. Sending 'learn' prompt to gemini-rag-chat function.");
        const response = await fetch(`https://yezjxwahexsfbvhfxsji.supabase.co/functions/v1/gemini-rag-chat`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${session.access_token}`,
          },
          body: JSON.stringify({ prompt: currentInput }),
        });

        console.log("AiChat: Response status from gemini-rag-chat:", response.status);
        if (!response.ok) {
          const errorData = await response.json();
          console.error("AiChat: Error response from gemini-rag-chat:", errorData);
          throw new Error(errorData.error || 'Failed to fetch stream');
        }

        // --- TEMPORARY: Handle non-streaming response ---
        const data = await response.json();
        console.log("AiChat: Received non-streaming data:", data);
        setMessages(prev => {
          const newMessages = [...prev];
          newMessages[newMessages.length - 1].content = data.response;
          return newMessages;
        });
        // --- END TEMPORARY CHANGE ---

        /*
        // Original streaming code (commented out for debugging)
        const reader = response.body!.getReader();
        const decoder = new TextDecoder();
        let buffer = '';

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split('\n').filter(line => line.startsWith('data: '));
          for (const line of lines) {
            const jsonString = line.substring(6);
            try {
              const parsed = JSON.parse(jsonString);
              const text = parsed.candidates[0]?.content?.parts[0]?.text;
              if (text) {
                setMessages(prev => {
                  const newMessages = [...prev];
                  const lastMessage = newMessages[newMessages.length - 1];
                  if (lastMessage.role === 'assistant') {
                    lastMessage.content += text;
                  }
                  return newMessages;
                });
              }
            } catch (e) {
              console.warn("AiChat: Failed to parse JSON chunk from stream:", e, "Chunk:", jsonString);
            }
          }
        }
        */
      }
    } catch (err: any) {
      const errorMessage = `Sorry, I encountered an error: ${err.message}`;
      console.error("AiChat: Error in handleSubmit:", err);
      setMessages(prev => {
        const newMessages = [...prev];
        const lastMessage = newMessages[newMessages.length - 1];
        if (lastMessage.role === 'assistant') {
          lastMessage.content = errorMessage;
        } else {
          newMessages.push({ role: 'assistant', content: errorMessage });
        }
        return newMessages;
      });
    } finally {
      setIsLoading(false);
      console.log("AiChat: Loading set to false.");
    }
  };

  return (
    <div className="flex flex-col h-full">
      <div className="flex justify-center mb-4 p-1 bg-background rounded-lg">
        <Button 
          variant={mode === 'create' ? 'secondary' : 'ghost'} 
          onClick={() => setMode('create')}
          className="flex-1"
        >
          <Music className="h-4 w-4 mr-2"/>
          Create
        </Button>
        <Button 
          variant={mode === 'learn' ? 'secondary' : 'ghost'} 
          onClick={() => setMode('learn')}
          className="flex-1"
        >
          <BrainCircuit className="h-4 w-4 mr-2"/>
          Learn
        </Button>
      </div>
      <p className="text-muted-foreground text-sm mb-4 text-center">
        {mode === 'create'
          ? 'Your creative partner for making music.'
          : 'Your music theory expert. Ask about scales, chords, genres, and more.'}
      </p>
      <ScrollArea className="flex-grow mb-4 pr-4" ref={scrollAreaRef}>
        <div className="space-y-4">
          {messages.map((message, index) => (
            <div key={index} className={`flex items-start gap-3 ${message.role === 'user' ? 'justify-end' : ''}`}>
              {message.role === 'assistant' && <Bot className="h-6 w-6 flex-shrink-0 text-yellow-400" />}
              <div className={cn('rounded-lg px-3 py-2 text-sm max-w-[85%]', message.role === 'user' ? 'bg-blue-600 text-white' : 'bg-muted')}>
                <p className="whitespace-pre-wrap">{message.content}</p>
              </div>
              {message.role === 'user' && <User className="h-6 w-6 flex-shrink-0" />}
            </div>
          ))}
          {isLoading && messages[messages.length - 1]?.content === '' && (
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
          placeholder={mode === 'create' ? 'Create a funky bassline...' : 'What is a major scale?'}
          className="flex-grow bg-background/80"
          disabled={isLoading || (mode === 'learn' && !session)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault();
              handleSubmit(e);
            }
          }}
        />
        <Button type="submit" disabled={isLoading || (mode === 'learn' && !session)}>
          Send
        </Button>
      </form>
      {mode === 'learn' && !session && (
        <p className="text-red-500 text-sm mt-2 text-center">
          You must be logged in to use the Learn feature.
        </p>
      )}
    </div>
  );
};