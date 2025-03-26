// src/utils/socket.js
import io from 'socket.io-client';

const SERVER_URL = 'http://192.168.1.69:4000';
const socket = io(SERVER_URL, { transports: ['websocket'], reconnection: true, reconnectionAttempts: 5 });

export const initializeSocket = (username, sessionId, onConnect, onPrivateMessageHistory, onNewPrivateMessage, onPublicKeyUpdate, onPrivateMessageError, onSearchResults, onConnectError, onReconnect, onReconnectError, onReconnectFailed) => {
  socket.on('connect', () => {
    console.log('Підключено до сервера, socket.id:', socket.id);
    socket.emit('join', { username, sessionId });
    onConnect();
  });

  socket.on('privateMessageHistory', onPrivateMessageHistory);
  socket.on('newPrivateMessage', onNewPrivateMessage);
  socket.on('publicKeyUpdate', onPublicKeyUpdate);
  socket.on('privateMessageError', onPrivateMessageError);
  socket.on('searchResults', onSearchResults);
  socket.on('connect_error', onConnectError);
  socket.on('reconnect', onReconnect);
  socket.on('reconnect_error', onReconnectError);
  socket.on('reconnect_failed', onReconnectFailed);

  return () => {
    socket.off('privateMessageHistory');
    socket.off('newPrivateMessage');
    socket.off('publicKeyUpdate');
    socket.off('privateMessageError');
    socket.off('searchResults');
    socket.off('connect');
    socket.off('connect_error');
    socket.off('reconnect');
    socket.off('reconnect_error');
    socket.off('reconnect_failed');
  };
};

export const emitSetPublicKey = (username, publicKey) => {
  socket.emit('setPublicKey', { username, publicKey });
};

export const emitSendPrivateMessage = (receiver, content, tempId) => {
  socket.emit('sendPrivateMessage', { receiver, content, tempId });
};

export const emitSearchUser = (searchTerm) => {
  socket.emit('searchUser', { searchTerm });
};

export const emitLeave = (username, sessionId) => {
  socket.emit('leave', { username, sessionId });
};

export const isSocketConnected = () => socket.connected;