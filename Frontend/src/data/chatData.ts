import type { User, Message, ChatItem, Tab, VoiceChannel, NavItem } from './types';

export const currentUser: User = {
  id: '',
  name: '',
  avatar: '',
  avatarColor: 'transparent',
  status: 'offline',
};

export const activeChat: User = {
  id: '',
  name: '',
  avatar: '',
  avatarColor: 'transparent',
  status: 'offline',
};

export const users: Record<string, User> = {};

export const tabs: Tab[] = [];

export const chatList: ChatItem[] = [];

export const messages: Message[] = [];

export const voiceChannel: VoiceChannel = {
  id: '',
  name: '',
  tag: '',
  isConnected: false,
};

export const sidebarNavItems: NavItem[] = [];
