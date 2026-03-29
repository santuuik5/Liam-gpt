// Elementos del DOM
const newChatBtn = document.getElementById('newChatBtn');
const chatHistory = document.getElementById('chatHistory');
const menuToggle = document.getElementById('menuToggle');
const welcomeMessage = document.getElementById('welcomeMessage');
const messagesContainer = document.getElementById('messages');
const messageInput = document.getElementById('messageInput');
const sendBtn = document.getElementById('sendBtn');
const chatContainer = document.getElementById('chatContainer');

// Configuración de la API de NVIDIA
const API_KEY = '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';
const API_URL = 'https://integrate.api.nvidia.com/v1/chat/completions';
const MODEL = 'meta/llama-3.1-70b-instruct';

// Estado de la aplicación
let chats = [];
let currentChatId = null;

// Inicializar
document.addEventListener('DOMContentLoaded', () => {
    loadChatsFromStorage();
    renderChatHistory();
    
    if (chats.length > 0) {
        selectChat(chats[0].id);
    }
});

// Event Listeners
newChatBtn.addEventListener('click', createNewChat);
menuToggle.addEventListener('click', toggleSidebar);
sendBtn.addEventListener('click', sendMessage);
messageInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        sendMessage();
    }
});

// Auto-resize del textarea
messageInput.addEventListener('input', function() {
    this.style.height = 'auto';
    this.style.height = Math.min(this.scrollHeight, 200) + 'px';
});

// Funciones principales
function createNewChat() {
    const newChat = {
        id: Date.now(),
        title: 'Nuevo chat',
        messages: []
    };
    
    chats.unshift(newChat);
    saveChatsToStorage();
    renderChatHistory();
    selectChat(newChat.id);
    
    // En móvil, cerrar sidebar después de crear nuevo chat
    if (window.innerWidth <= 768) {
        document.querySelector('.sidebar').classList.remove('active');
    }
}

function selectChat(chatId) {
    currentChatId = chatId;
    const chat = chats.find(c => c.id === chatId);
    
    if (!chat) return;
    
    // Ocultar mensaje de bienvenida
    welcomeMessage.style.display = 'none';
    messagesContainer.classList.add('active');
    
    // Renderizar mensajes
    renderMessages(chat.messages);
    
    // Actualizar historial visualmente
    document.querySelectorAll('.chat-history-item').forEach(item => {
        item.classList.remove('active');
        if (parseInt(item.dataset.chatId) === chatId) {
            item.classList.add('active');
        }
    });
}

function renderMessages(messages) {
    messagesContainer.innerHTML = '';
    
    messages.forEach(msg => {
        const messageElement = createMessageElement(msg.role, msg.content);
        messagesContainer.appendChild(messageElement);
    });
    
    scrollToBottom();
}

function createMessageElement(role, content) {
    const messageDiv = document.createElement('div');
    messageDiv.className = `message ${role}`;
    
    const avatarContent = role === 'user' ? 'U' : 'AI';
    const avatarColor = role === 'user' ? '#10a37f' : '#19c37d';
    
    messageDiv.innerHTML = `
        <div class="message-content">
            <div class="message-avatar" style="background-color: ${avatarColor}">
                ${avatarContent}
            </div>
            <div class="message-text">${escapeHtml(content)}</div>
        </div>
    `;
    
    return messageDiv;
}

function sendMessage() {
    const content = messageInput.value.trim();
    
    if (!content || !currentChatId) return;
    
    const chat = chats.find(c => c.id === currentChatId);
    if (!chat) return;
    
    // Agregar mensaje del usuario
    chat.messages.push({
        role: 'user',
        content: content
    });
    
    // Actualizar título si es el primer mensaje
    if (chat.messages.length === 1) {
        chat.title = content.substring(0, 30) + (content.length > 30 ? '...' : '');
        renderChatHistory();
    }
    
    // Limpiar input
    messageInput.value = '';
    messageInput.style.height = 'auto';
    
    // Renderizar mensaje del usuario
    const userMessageElement = createMessageElement('user', content);
    messagesContainer.appendChild(userMessageElement);
    scrollToBottom();
    
    // Guardar cambios
    saveChatsToStorage();
    
    // Llamar a la API de NVIDIA
    callNvidiaAPI(chat);
}

async function callNvidiaAPI(chat) {
    // Mostrar indicador de "escribiendo..."
    const loadingElement = document.createElement('div');
    loadingElement.className = 'message ai';
    loadingElement.innerHTML = `
        <div class="message-content">
            <div class="message-avatar" style="background-color: #19c37d">AI</div>
            <div class="message-text typing">
                <span></span><span></span><span></span>
            </div>
        </div>
    `;
    messagesContainer.appendChild(loadingElement);
    scrollToBottom();
    
    try {
        // Preparar mensajes para la API
        const apiMessages = chat.messages.map(msg => ({
            role: msg.role === 'ai' ? 'assistant' : msg.role,
            content: msg.content
        }));
        
        const response = await fetch(API_URL, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${API_KEY}`
            },
            body: JSON.stringify({
                model: MODEL,
                messages: apiMessages,
                temperature: 0.7,
                max_tokens: 1024,
                stream: false
            })
        });
        
        if (!response.ok) {
            throw new Error(`Error ${response.status}: ${response.statusText}`);
        }
        
        const data = await response.json();
        const aiResponse = data.choices[0].message.content;
        
        // Remover indicador de carga
        messagesContainer.removeChild(loadingElement);
        
        // Agregar respuesta de IA
        chat.messages.push({
            role: 'ai',
            content: aiResponse
        });
        
        const aiMessageElement = createMessageElement('ai', aiResponse);
        messagesContainer.appendChild(aiMessageElement);
        scrollToBottom();
        
        saveChatsToStorage();
        
    } catch (error) {
        console.error('Error calling NVIDIA API:', error);
        messagesContainer.removeChild(loadingElement);
        
        const errorMessage = `Error al obtener respuesta: ${error.message}. Verifica tu conexión o la API key.`;
        chat.messages.push({
            role: 'ai',
            content: errorMessage
        });
        
        const aiMessageElement = createMessageElement('ai', errorMessage);
        messagesContainer.appendChild(aiMessageElement);
        scrollToBottom();
        
        saveChatsToStorage();
    }
}

function renderChatHistory() {
    chatHistory.innerHTML = '';
    
    chats.forEach(chat => {
        const chatItem = document.createElement('div');
        chatItem.className = 'chat-history-item';
        chatItem.dataset.chatId = chat.id;
        chatItem.textContent = chat.title;
        chatItem.addEventListener('click', () => selectChat(chat.id));
        chatHistory.appendChild(chatItem);
    });
}

function toggleSidebar() {
    const sidebar = document.querySelector('.sidebar');
    sidebar.classList.toggle('active');
}

function scrollToBottom() {
    chatContainer.scrollTop = chatContainer.scrollHeight;
}

function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

// Local Storage functions
function saveChatsToStorage() {
    localStorage.setItem('liam-gpt-chats', JSON.stringify(chats));
}

function loadChatsFromStorage() {
    const saved = localStorage.getItem('liam-gpt-chats');
    if (saved) {
        chats = JSON.parse(saved);
    }
}
