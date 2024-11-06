import React, { useState, useEffect, useRef } from "react";
import axios from "axios";

const Chat = () => {
  const [messages, setMessages] = useState([]);
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [ws, setWs] = useState(null);
  const [token, setToken] = useState(null);
  const [messageInput, setMessageInput] = useState("");
  const [recipient, setRecipient] = useState("");
  const [tempRecipient, setTempRecipient] = useState(""); // Temporary state for input
  const [userStatus, setUserStatus] = useState({}); // Track recipient status and last online time
  const lastMessageRef = useRef(null);
  const messageInputRef = useRef(null);
const [loding,setLoding]=useState(false)
  useEffect(() => {
    if (Notification.permission !== "granted") {
      Notification.requestPermission();
    }
  }, []);
 // Get allowed recipients from environment variables
const allowedRecipients = process.env.REACT_APP_ALLOWED_RECIPIENTS
? process.env.REACT_APP_ALLOWED_RECIPIENTS.split(",")
: [];
  // Establish WebSocket connection and handle messages
  // console.log(allowedRecipients,"reciepent")
  useEffect(() => {
    if (token) {
      const wsConnection = new WebSocket("wss://chat-ijqh.onrender.com");
      setWs(wsConnection);

      wsConnection.onopen = () => {
        console.log("Connected to WebSocket as:", username);
        wsConnection.send(JSON.stringify({ type: "join", token }));
      };

      wsConnection.onmessage = (event) => {
        const data = JSON.parse(event.data);

        if (data.type === "message") {
          setMessages((prev) => [...prev, data]);
        } else if (data.type === "user-status") {
          console.log("Received user status:", data.users, "Requested:", recipient);
          console.log(" from local host",localStorage.getItem('recipient'));
          const status = data.users.find((user) => user.username === localStorage.getItem('recipient'));
          if (status) {
            console.log(status)
            setUserStatus({
              isOnline: status.isOnline,
              lastOnline: status.lastOnline,
            });
          }
        }
      };

      wsConnection.onclose = () => {
        setWs(null);
        // logout();
      };

      window.addEventListener("beforeunload", logout); // Clear token on refresh or tab close
      return () => {
        wsConnection.close();
        window.removeEventListener("beforeunload", logout);
        localStorage.removeItem("recipient");

      };
    }
  }, [token]);

  // Request recipient's status whenever `recipient` is updated
  useEffect(() => {
    if (ws && recipient) {
      ws.send(JSON.stringify({ type: "get-user-status", recipient }));
    }
  }, [recipient, ws]);

  // Auto-scroll to the latest message
  useEffect(() => {
    if (lastMessageRef.current) {
      lastMessageRef.current.scrollIntoView({ behavior: "smooth" });
    }
  }, [messages]);

  const sendMessage = () => {
    if (!recipient.trim()) {
      alert("Please specify a recipient.");
      return;
    }
    if (ws && messageInput.trim() && recipient.trim()) {
      const messageData = {
        type: "message",
        token,
        sender: username,
        recipient,
        content: messageInput,
        timestamp: new Date().toLocaleTimeString(),
      };
      ws.send(JSON.stringify(messageData));
      setMessageInput("");
      messageInputRef.current.focus()
    }
  };

  const handleInputChange = (e, setter) => {
    e.preventDefault();
    setter(e.target.value);
  };

  const confirmRecipient = () => {
    if (!tempRecipient.trim()) {
      alert("Please enter a recipient name.");
      return;
    }
    if (!allowedRecipients.includes(tempRecipient)) {
      alert("Recipient not available.");
      setMessages([]); // Clear messages if recipient is invalid
      setRecipient(""); // Reset recipient
      return;
    }
    setRecipient(tempRecipient);
    localStorage.setItem('recipient',tempRecipient)
    if (ws && tempRecipient) {
      // Send `get-user-status` request using `tempRecipient` directly
      ws.send(JSON.stringify({ type: "get-user-status", recipient: tempRecipient }));
    }
  };
  const handleKeyDown = (e) => {
    if (e.key === "Enter") {
      sendMessage();
    }
  };

  const login = async () => {
    try {
      setLoding(true)
      const response = await axios.post("https://chat-ijqh.onrender.com/login", { username, password });
      setToken(response.data.token);
      localStorage.setItem("token", response.data.token);
      setLoding(false)
    } catch (error) {
      console.error("Login failed", error);
    }
  };

  const logout = () => {
    if (ws) ws.close();
    setToken(null);
    setUsername("");
    setPassword("");
    setRecipient("");
    setMessages([]);
    setUserStatus({});
    localStorage.removeItem("token"); // Clear token from localStorage
    localStorage.removeItem("recipient"); // Clear token from localStorage
  };
console.log(recipient)
  return (
    <div className="w-full max-w-lg mx-auto p-4">
      {!token && (
        <div className="space-y-4">
          <input
            type="text"
            placeholder="Username"
            onChange={(e) => handleInputChange(e, setUsername)}
            value={username}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          <input
            type="password"
            placeholder="Password"
            onChange={(e) => handleInputChange(e, setPassword)}
            value={password}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          <button
            onClick={login}
            disabled={loding}
            className={`${loding ? 'disabled:opacity-50 cursor-not-allowed' : ''} w-full bg-blue-500 text-white py-2 rounded-md font-semibold hover:bg-blue-600 `}
          >
            {loding?"Loging...":"log in"}
          </button>
        </div>
      )}

      {token && (
        <>
          <div className="flex gap-2 items-center mb-4">
            <input
              type="text"
              placeholder="Recipient Username"
              onChange={(e) => handleInputChange(e, setTempRecipient)}
              value={tempRecipient}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            <button
              type="button"
              onClick={confirmRecipient}
              className="bg-green-500 text-white px-4 py-2 rounded-md font-semibold hover:bg-green-600"
            >
              Set Recipient
            </button>
            <button
              onClick={logout}
              className="bg-red-500 text-white px-4 py-2 rounded-md font-semibold hover:bg-red-600"
            >
              Logout
            </button>
          </div>

          <div className="mb-2 text-sm text-gray-500">
            {userStatus.isOnline
              ? "Online"
              : `Last online: ${
                  userStatus.lastOnline ? new Date(userStatus.lastOnline).toLocaleString() : "N/A"
                }`}
          </div>

          <div className="space-y-4 pb-20">
            {recipient && messages.map((msg, index) => (
              <div  className={`flex ${msg.sender === username ? "justify-end" : "justify-start"} gap-2.5`}
              key={index}>
                {msg.sender !== username && (
                  <img
                    src="https://pagedone.io/asset/uploads/1710412177.png"
                    alt="Recipient"
                    className="w-10 h-11"
                  />
                )}
                <div className="w-max grid">
                  <h5 className="text-sm font-semibold leading-snug pb-1">
                    {msg.sender === username ? "You" : msg.sender}
                  </h5>
                  <div
                    className={`px-3.5 py-2 rounded inline-flex ${
                      msg.sender === username ? "bg-indigo-600 text-white text-right" : "bg-gray-100 text-gray-900"
                    }`}
                  >
                    <h5 className="text-sm font-normal leading-snug">{msg.content}</h5>
                  </div>
                  <div className="justify-end items-center inline-flex mb-2.5">
                    <h6 className="text-gray-500 text-xs font-normal leading-4 py-1">
                      {msg.timestamp || new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                    </h6>
                  </div>
                </div>
                {msg.sender === username && (
                  <img
                    src="https://pagedone.io/asset/uploads/1704091591.png"
                    alt="You"
                    className="w-10 h-11"
                  />
                )}
              </div>
            ))}
            <div ref={lastMessageRef} /> {/* Scroll to this element */}
          </div>

          <div className="fixed bottom-4 left-1/2 transform -translate-x-1/2 w-full max-w-lg pl-3 pr-1 py-1 rounded-3xl border border-gray-200 items-center gap-2 inline-flex justify-between bg-white shadow-lg">
            <div className="flex items-center gap-2 w-full">
              <input
                type="text"
                ref={messageInputRef}
                placeholder="Type here..."
                value={messageInput}
                onChange={(e) => handleInputChange(e, setMessageInput)}
                onKeyDown={handleKeyDown}
                className="grow shrink basis-0 text-black text-xs font-medium leading-4 focus:outline-none"
              />
              <button
                onClick={sendMessage}
                className="flex items-center px-3 py-2 bg-indigo-600 rounded-full shadow"
              >
                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 16 16" fill="none">
                  <path
                    d="M9.04071 6.959L6.54227 9.45744M6.89902 10.0724L7.03391 10.3054C8.31034 12.5102 8.94855 13.6125 9.80584 13.5252C10.6631 13.4379 11.0659 12.2295 11.8715 9.81261L13.0272 6.34566C13.7631 4.13794 14.1311 3.03408 13.5484 2.45139C12.9657 1.8687 11.8618 2.23666 9.65409 2.97257L6.18714 4.12822C3.77029 4.93383 2.56187 5.33664 2.47454 6.19392C2.38721 7.0512 3.48957 7.68941 5.69431 8.96584L5.92731 9.10074C6.23326 9.27786 6.38623 9.36643 6.50978 9.48998C6.63333 9.61352 6.72189 9.7665 6.89902 10.0724Z"
                    stroke="white"
                    strokeWidth="1.6"
                    strokeLinecap="round"
                  />
                </svg>
                <span className="text-white text-xs font-semibold leading-4 px-2">Send</span>
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
};

export default Chat;
