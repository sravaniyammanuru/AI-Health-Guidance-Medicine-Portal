'use client';

import { useState, useRef, useEffect } from 'react';
import { Navigation } from '@/components/navigation';
import { Card, CardContent } from '@/components/ui/card';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { api } from '@/lib/api';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth-context';
import { toast } from 'sonner';

interface Medicine {
  id: number;
  name: string;
  composition: string;
  price: number;
}

interface Message {
  id: number;
  sender: 'user' | 'ai';
  message: string;
  timestamp: Date;
  severity?: 'mild' | 'moderate' | 'severe';
  medicines?: Medicine[];
  recommendations?: string[];
  followUpQuestions?: string[];
  doctorConsultation?: 'required' | 'recommended' | 'optional';
  urgencyLevel?: 'immediate' | 'within 24 hours' | 'if symptoms worsen' | 'not urgent';
}

export default function PatientDashboardPage() {
  const [messages, setMessages] = useState<Message[]>([
    {
      id: 1,
      sender: 'ai',
      message: 'Hello! 👋 I\'m your AI health assistant powered by advanced medical AI.\n\n🩺 I can help you:\n• Understand your symptoms\n• Assess severity levels\n• Suggest appropriate medicines\n• Provide health recommendations\n• Guide you on whether to see a doctor\n\nPlease describe your symptoms in detail. The more information you provide, the better I can help you!\n\n🌍 Select your preferred language from the dropdown above and I\'ll respond in that language.',
      timestamp: new Date(),
    },
  ]);
  const [inputMessage, setInputMessage] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const [selectedLanguage, setSelectedLanguage] = useState('English');
  const scrollRef = useRef<HTMLDivElement>(null);
  const router = useRouter();
  const { user, userType, isLoading: authLoading } = useAuth();

  useEffect(() => {
    if (!authLoading) {
      if (!user) {
        router.push('/login');
      } else if (userType === 'doctor') {
        router.push('/doctor-dashboard');
      }
    }
  }, [user, userType, authLoading, router]);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  if (authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-muted-foreground">Loading...</p>
        </div>
      </div>
    );
  }

  if (!user || userType !== 'patient') {
    return null;
  }

  const handleSendMessage = async () => {
    if (!inputMessage.trim()) return;

    const newMessage: Message = {
      id: messages.length + 1,
      sender: 'user',
      message: inputMessage,
      timestamp: new Date(),
    };

    setMessages([...messages, newMessage]);
    const currentInput = inputMessage;
    setInputMessage('');
    setIsTyping(true);

    try {
      // Call real Gemini AI API with language preference
      const response = await api.analyzeSymptoms(currentInput, undefined, selectedLanguage);
      
      console.log('AI Response:', response);
      console.log('Suggested Medicines:', response.suggestedMedicines);
      
      const aiResponse: Message = {
        id: messages.length + 2,
        sender: 'ai',
        message: response.analysis || 'I\'ve analyzed your symptoms.',
        timestamp: new Date(),
        severity: response.severity as 'mild' | 'moderate' | 'severe',
        medicines: response.suggestedMedicines || [],
        recommendations: response.recommendations || [],
        followUpQuestions: response.followUpQuestions || [],
        doctorConsultation: response.doctorConsultation,
        urgencyLevel: response.urgencyLevel,
      };
      
      setMessages((prev) => [...prev, aiResponse]);
      setIsTyping(false);
    } catch (error) {
      console.error('AI Analysis Error:', error);
      toast.error('Failed to analyze symptoms. Please try again.');
      
      const errorResponse: Message = {
        id: messages.length + 2,
        sender: 'ai',
        message: 'I\'m having trouble analyzing your symptoms right now. Please make sure the backend server is running, or consult a doctor directly.',
        timestamp: new Date(),
      };
      
      setMessages((prev) => [...prev, errorResponse]);
      setIsTyping(false);
    }
  };

  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case 'mild':
        return 'bg-green-100 text-green-700 border-green-300';
      case 'moderate':
        return 'bg-yellow-100 text-yellow-700 border-yellow-300';
      case 'severe':
        return 'bg-red-100 text-red-700 border-red-300';
      default:
        return 'bg-muted text-muted-foreground';
    }
  };

  return (
    <div className="min-h-screen">
      <Navigation />
      <main className="container mx-auto px-4 py-6 max-w-4xl">
        <div className="mb-4 flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-semibold text-foreground mb-1">
              AI Health Assistant
            </h1>
            <p className="text-sm text-muted-foreground">
              Describe your symptoms and get instant health advice
            </p>
          </div>
          
          {/* Language Selector */}
          <div className="flex items-center gap-2">
            <span className="text-sm text-muted-foreground">🌍 Language:</span>
            <Select value={selectedLanguage} onValueChange={setSelectedLanguage}>
              <SelectTrigger className="w-35">
                <SelectValue placeholder="Select language" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="English">English</SelectItem>
                <SelectItem value="Hindi">हिंदी (Hindi)</SelectItem>
                <SelectItem value="Spanish">Español</SelectItem>
                <SelectItem value="French">Français</SelectItem>
                <SelectItem value="German">Deutsch</SelectItem>
                <SelectItem value="Chinese">中文</SelectItem>
                <SelectItem value="Japanese">日本語</SelectItem>
                <SelectItem value="Arabic">العربية</SelectItem>
                <SelectItem value="Portuguese">Português</SelectItem>
                <SelectItem value="Russian">Русский</SelectItem>
                <SelectItem value="Bengali">বাংলা</SelectItem>
                <SelectItem value="Tamil">தமிழ்</SelectItem>
                <SelectItem value="Telugu">తెలుగు</SelectItem>
                <SelectItem value="Marathi">मराठी</SelectItem>
                <SelectItem value="Gujarati">ગુજરાતી</SelectItem>
                <SelectItem value="Kannada">ಕನ್ನಡ</SelectItem>
                <SelectItem value="Malayalam">മലയാളം</SelectItem>
                <SelectItem value="Punjabi">ਪੰਜਾਬੀ</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="space-y-4">
          <ScrollArea ref={scrollRef} className="h-[calc(100vh-300px)] px-2">
            <div className="space-y-4">
              {messages.map((msg) => (
                  <div
                    key={msg.id}
                    className={`flex ${
                      msg.sender === 'user' ? 'justify-end' : 'justify-start'
                    }`}
                  >
                    <div
                      className={`max-w-[80%] ${
                        msg.sender === 'user'
                          ? 'bg-primary text-primary-foreground'
                          : 'bg-muted text-foreground'
                      } rounded-2xl px-4 py-2.5 shadow-sm`}
                    >
                      {msg.sender === 'ai' && 'severity' in msg && msg.severity && (
                        <Badge
                          className={`mb-2 ${getSeverityColor(msg.severity)}`}
                          variant="outline"
                        >
                          {msg.severity.toUpperCase()}
                        </Badge>
                      )}
                      <div
                        className={`text-sm leading-relaxed whitespace-pre-wrap ${
                          msg.sender === 'user' ? 'text-primary-foreground' : 'text-foreground'
                        }`}
                      >
                        {msg.message}
                      </div>
                      
                      {/* Follow-up Questions - Show prominently when present */}
                      {msg.sender === 'ai' && msg.followUpQuestions && msg.followUpQuestions.length > 0 && (
                        <div className="mt-3 p-3 bg-blue-50 border border-blue-200 rounded-lg">
                          <p className="text-sm font-semibold text-blue-900 mb-2">❓ Please provide more information:</p>
                          <div className="space-y-1.5">
                            {msg.followUpQuestions.map((q: string, idx: number) => (
                              <div
                                key={idx}
                                className="text-sm text-blue-700 flex items-start"
                              >
                                <span className="mr-1.5">{idx + 1}.</span>
                                <span>{q}</span>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                      
                      {/* Only show severity info if no follow-up questions and has severity */}
                      {msg.sender === 'ai' && (!msg.followUpQuestions || msg.followUpQuestions.length === 0) && (
                        <>
                          {/* Urgency Warning */}
                          {msg.urgencyLevel && (
                            <div className={`mt-3 p-2 rounded-lg text-xs ${
                              msg.urgencyLevel === 'immediate' ? 'bg-red-50 text-red-700 border border-red-200' :
                              msg.urgencyLevel === 'within 24 hours' ? 'bg-orange-50 text-orange-700 border border-orange-200' :
                              'bg-blue-50 text-blue-700 border border-blue-200'
                            }`}>
                              <span className="font-semibold">⏰ Urgency: </span>
                              {msg.urgencyLevel === 'immediate' ? 'Seek medical attention immediately' :
                               msg.urgencyLevel === 'within 24 hours' ? 'Consult a doctor within 24 hours' :
                               msg.urgencyLevel === 'if symptoms worsen' ? 'Monitor and consult if symptoms worsen' :
                               'Not urgent, but monitor symptoms'}
                            </div>
                          )}
                          
                          {/* Doctor Consultation */}
                          {msg.doctorConsultation && (
                            <div className={`mt-2 p-2 rounded-lg text-xs ${
                              msg.doctorConsultation === 'required' ? 'bg-red-50 text-red-700 border border-red-200' :
                              msg.doctorConsultation === 'recommended' ? 'bg-yellow-50 text-yellow-700 border border-yellow-200' :
                              'bg-green-50 text-green-700 border border-green-200'
                            }`}>
                              <span className="font-semibold">👨‍⚕️ Doctor Consultation: </span>
                              {msg.doctorConsultation === 'required' ? 'Required - Please see a doctor' :
                               msg.doctorConsultation === 'recommended' ? 'Recommended for proper diagnosis' :
                               'Optional - Self-care may be sufficient'}
                            </div>
                          )}
                        </>
                      )}
                      
                      {/* Medicines - only show if there are medicines */}
                      {msg.sender === 'ai' && msg.medicines && msg.medicines.length > 0 && (
                        <div className="mt-3 space-y-2">
                          <p className="text-xs font-medium text-muted-foreground mb-2">💊 Suggested Medicines:</p>
                          {msg.medicines.map((medicine) => (
                            <Card key={medicine.id} className="bg-card/50 border-border">
                              <CardContent className="p-3">
                                <div className="flex items-center justify-between">
                                  <div>
                                    <p className="font-medium text-sm text-foreground">
                                      {medicine.name}
                                    </p>
                                    <p className="text-xs text-muted-foreground mt-0.5">
                                      {medicine.composition?.substring(0, 50)}...
                                    </p>
                                    <p className="text-xs text-muted-foreground mt-0.5">
                                      ₹{medicine.price}
                                    </p>
                                  </div>
                                  <Button
                                    size="sm"
                                    onClick={() => {
                                      // Pass medicine data via URL params
                                      const medicineData = encodeURIComponent(JSON.stringify(medicine));
                                      router.push(`/order?addMedicine=${medicineData}`);
                                    }}
                                    className="text-xs"
                                  >
                                    Order Now
                                  </Button>
                                </div>
                              </CardContent>
                            </Card>
                          ))}
                        </div>
                      )}
                      
                      {/* Recommendations - only show if there are recommendations */}
                      {msg.sender === 'ai' && msg.recommendations && msg.recommendations.length > 0 && (
                        <div className="mt-3 space-y-1.5">
                          <p className="text-xs font-medium text-muted-foreground mb-1">💡 Recommendations:</p>
                          {msg.recommendations.map((rec, idx) => (
                            <div key={idx} className="text-xs text-muted-foreground flex items-start">
                              <span className="mr-1.5">•</span>
                              <span>{rec}</span>
                            </div>
                          ))}
                        </div>
                      )}
                      <div
                        className={`text-xs mt-1.5 ${
                          msg.sender === 'user'
                            ? 'text-primary-foreground/70'
                            : 'text-muted-foreground'
                        }`}
                      >
                        {msg.timestamp.toLocaleTimeString([], {
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                      </div>
                    </div>
                  </div>
                ))}
                {isTyping && (
                  <div className="flex justify-start">
                    <div className="bg-muted rounded-2xl px-4 py-3 shadow-sm">
                      <div className="flex space-x-1.5">
                        <div className="w-2 h-2 bg-muted-foreground rounded-full animate-bounce" />
                        <div
                          className="w-2 h-2 bg-muted-foreground rounded-full animate-bounce"
                          style={{ animationDelay: '0.2s' }}
                        />
                        <div
                          className="w-2 h-2 bg-muted-foreground rounded-full animate-bounce"
                          style={{ animationDelay: '0.4s' }}
                        />
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </ScrollArea>

            <div className="border-t border-border bg-background/50 backdrop-blur-sm p-4 rounded-b-xl">
              <div className="flex space-x-2">
                <Textarea
                  placeholder="Describe your symptoms..."
                  value={inputMessage}
                  onChange={(e) => setInputMessage(e.target.value)}
                  onKeyPress={(e) => e.key === 'Enter' && !e.shiftKey && handleSendMessage()}
                  className="flex-1 text-sm min-h-15 max-h-30 resize-none"
                />
                <Button onClick={handleSendMessage} className="px-6 self-end">
                  Send
                </Button>
              </div>
            </div>
        </div>
      </main>
    </div>
  );
}
