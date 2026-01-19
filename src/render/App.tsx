import React, { useState, useEffect, useRef } from 'react';
import "./App.css";

interface Message {
  sender: 'user' | 'agent' | 'system';
  text: string;
}

const App = () => {
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputText, setInputText] = useState("");
  const [agentCommand, setAgentCommand] = useState("qwen --acp");
  const [isConnected, setIsConnected] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    // Listen for agent messages
    const removeListener = window.electron.on("agent:message", (msg: string) => {
       // Check if msg is object (if serialized weirdly)
       const text = typeof msg === 'string' ? msg : JSON.stringify(msg);
       addMessage('agent', text);
    });
    return () => {
        removeListener();
    };
  }, []);

  const addMessage = (sender: Message['sender'], text: string) => {
    setMessages(prev => [...prev, { sender, text }]);
    setTimeout(scrollToBottom, 100);
  };

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  const handleConnect = async () => {
    if (isConnected) {
        await window.electron.invoke("agent:disconnect");
        setIsConnected(false);
        addMessage('system', "Disconnected.");
    } else {
        addMessage('system', `Connecting to: ${agentCommand}...`);
        const result = await window.electron.invoke("agent:connect", agentCommand);
        if (result.success) {
            setIsConnected(true);
            addMessage('system', "Connected!");
        } else {
            addMessage('system', `Connection failed: ${result.error}`);
        }
    }
  };

  const handleSend = async () => {
    if (!inputText.trim()) return;
    if (!isConnected) {
        addMessage('system', "Error: Not connected to agent.");
        return;
    }

    const text = inputText;
    setInputText("");
    addMessage('user', text);

    try {
        await window.electron.invoke("agent:send", text);
    } catch (e: any) {
        addMessage('system', `Send error: ${e.message}`);
    }
  };

  return (
    <div className="container" style={{ display: 'flex', flexDirection: 'column', height: '100vh', padding: '20px', boxSizing: 'border-box' }}>
      <h1>ACP Client Chat</h1>
      
      <div className="connection-bar" style={{ display: 'flex', gap: '10px', marginBottom: '20px' }}>
        <input 
            type="text" 
            value={agentCommand} 
            onChange={(e) => setAgentCommand(e.target.value)}
            placeholder="Agent Command (e.g. npx tsx agent.ts)"
            style={{ flex: 1, padding: '8px', borderRadius: '4px', border: '1px solid #ccc', color: '#333' }}
        />
        <button onClick={handleConnect} style={{ padding: '8px 16px', cursor: 'pointer' }}>
            {isConnected ? "Disconnect" : "Connect"}
        </button>
      </div>

      <div className="chat-window" style={{ 
          flex: 1, 
          border: '1px solid #ccc', 
          borderRadius: '4px', 
          padding: '10px', 
          overflowY: 'auto',
          backgroundColor: '#f5f5f5',
          marginBottom: '20px'
      }}>
        {messages.map((msg, idx) => (
            <div key={idx} style={{ 
                marginBottom: '8px', 
                textAlign: msg.sender === 'user' ? 'right' : 'left',
                color: msg.sender === 'system' ? '#888' : 'black'
            }}>
                <span style={{ 
                    background: msg.sender === 'user' ? '#007bff' : (msg.sender === 'agent' ? '#fff' : 'transparent'),
                    color: msg.sender === 'user' ? 'white' : 'black',
                    padding: '8px 12px',
                    borderRadius: '12px',
                    display: 'inline-block',
                    maxWidth: '80%',
                    border: msg.sender === 'agent' ? '1px solid #ddd' : 'none',
                    whiteSpace: 'pre-wrap',
                    wordBreak: 'break-word'
                }}>
                    {msg.sender === 'system' && <strong>[System] </strong>}
                    {msg.sender === 'agent' && <strong>[Agent] </strong>}
                    {msg.text}
                </span>
            </div>
        ))}
        <div ref={messagesEndRef} />
      </div>

      <div className="input-area" style={{ display: 'flex', gap: '10px' }}>
        <input 
            type="text" 
            value={inputText}
            onChange={(e) => setInputText(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleSend()}
            placeholder="Type a message..."
            style={{ flex: 1, padding: '10px', borderRadius: '4px', border: '1px solid #ccc', color: '#333' }}
            disabled={!isConnected}
        />
        <button onClick={handleSend} disabled={!isConnected} style={{ padding: '10px 20px', cursor: 'pointer' }}>Send</button>
      </div>
    </div>
  );
};

export default App;
