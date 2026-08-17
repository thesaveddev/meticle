import { useState, useCallback } from 'react'
import { Box, Paper, Stack, Avatar, Typography, Tooltip, IconButton, Dialog, DialogTitle, DialogContent, DialogActions, Button, Snackbar, Alert, Menu } from '@mui/material'
import { Groups as GroupsIcon, Forum as ForumIcon, ArrowBack as ArrowBackIcon } from '@mui/icons-material'
import { useChat } from './hooks/useChat'
import { getChannelName, getChannelAvatar, EMOJIS, NAVY, NAVY_DEEP, EMERALD, INK, MIST, BONE, HAIRLINE, WHITE } from './utils'
import ChannelSidebar from './components/ChannelSidebar'
import MessageList from './components/MessageList'
import ChatComposer from './components/ChatComposer'
import SharedFiles from './components/SharedFiles'
import CreateGroupDialog from './components/CreateGroupDialog'
import StartDMDialog from './components/StartDMDialog'
import MemberListDialog from './components/MemberListDialog'

export default function ChatPage() {
  const chat = useChat()
  const [drawerOpen, setDrawerOpen] = useState(true)
  const [activeTab, setActiveTab] = useState(0)
  const [showMembers, setShowMembers] = useState(false)
  const [groupDialog, setGroupDialog] = useState(false)
  const [dmDialog, setDmDialog] = useState(false)
  const [deleteConfirm, setDeleteConfirm] = useState<any>(null)
  const [leaveConfirm, setLeaveConfirm] = useState(false)
  const [reactionPicker, setReactionPicker] = useState<{ msgId: string; anchor: HTMLElement } | null>(null)

  const activeChannelData = chat.activeChannelData
  const channelType = activeChannelData?.type || ''
  const channelName = activeChannelData ? getChannelName(activeChannelData, chat.currentUserId) : ''
  const { initials: channelInitials, avatar: channelAvatar } = activeChannelData
    ? getChannelAvatar(activeChannelData, chat.currentUserId)
    : { initials: '?', avatar: '' }

  const getOnlineCount = useCallback((ch: any) => ch?.members ? ch.members.filter((m: any) => chat.onlineUsers.has(m.user_id)).length : 0, [chat.onlineUsers])

  const handleDownload = useCallback(async (url: string, name: string) => {
    const token = localStorage.getItem('accessToken')
    try {
      const res = await fetch(url, { headers: token ? { Authorization: `Bearer ${token}` } : {} })
      const blob = await res.blob()
      const blobUrl = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = blobUrl; a.download = name
      document.body.appendChild(a); a.click(); document.body.removeChild(a)
      URL.revokeObjectURL(blobUrl)
    } catch { /* silent */ }
  }, [])

  const openFilePreview = useCallback(async (url: string, _name: string) => {
    window.open(url, '_blank')
  }, [])

  const handleFileUpload = useCallback(async (file: File) => {
    await chat.handleFileUpload(file)
  }, [chat.handleFileUpload])

  return (
    <Box sx={{ display: 'flex', height: 'calc(100vh - 112px)', overflow: 'hidden', bgcolor: BONE, p: { xs: 0, md: 1.5 }, boxSizing: 'border-box' }}>
      <Paper elevation={0} sx={{ flex: 1, minWidth: 0, display: 'flex', overflow: 'hidden', borderRadius: { xs: 0, md: 2 }, border: { xs: 'none', md: `1px solid ${HAIRLINE}` } }}>

        {/* Sidebar */}
        {drawerOpen && (
          <ChannelSidebar
            channels={chat.channels} activeChannel={chat.activeChannel}
            onSelectChannel={id => { chat.setActiveChannel(id); setActiveTab(0) }}
            orgMembers={chat.orgMembers} onlineUsers={chat.onlineUsers}
            totalUnread={chat.totalUnread} searchQuery={chat.searchQuery}
            onSearchChange={chat.setSearchQuery} searchResults={chat.searchResults}
            searching={chat.searching} currentUserId={chat.currentUserId}
            onNewDM={() => setDmDialog(true)} onNewGroup={() => setGroupDialog(true)}
          />
        )}

        {/* Main area */}
        <Box sx={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', bgcolor: WHITE }}>
          {/* Header */}
          <Box sx={{ px: 2, py: 1.25, borderBottom: `1px solid ${HAIRLINE}`, display: 'flex', alignItems: 'center', justifyContent: 'space-between', bgcolor: WHITE, minHeight: 52 }}>
            <Stack direction="row" spacing={1.5} alignItems="center">
              {!drawerOpen && (
                <IconButton size="small" onClick={() => setDrawerOpen(true)} sx={{ color: NAVY }}>
                  <ArrowBackIcon sx={{ fontSize: 20 }} />
                </IconButton>
              )}
              {(channelType === 'general' || channelType === 'group') ? (
                <Avatar sx={{
                  bgcolor: channelType === 'general' ? NAVY : BONE,
                  color: channelType === 'general' ? WHITE : NAVY,
                  border: `1px solid ${channelType === 'general' ? NAVY_DEEP : HAIRLINE}`,
                  width: 34, height: 34, fontSize: 14,
                }}>
                  {channelType === 'general' ? '#' : channelInitials}
                </Avatar>
              ) : (
                <Avatar src={channelAvatar || undefined}
                  sx={{ bgcolor: BONE, color: NAVY, border: `1px solid ${HAIRLINE}`, width: 34, height: 34, fontSize: 14 }}>
                  {channelInitials}
                </Avatar>
              )}
              <Box>
                <Stack direction="row" spacing={0.75} alignItems="center">
                  <Typography variant="subtitle2" fontWeight={800} sx={{ fontSize: 14, color: INK }}>
                    {channelName || 'Select a conversation'}
                  </Typography>
                  {(channelType === 'general' || channelType === 'group') && getOnlineCount(activeChannelData) > 0 && (
                    <Stack direction="row" spacing={0.5} alignItems="center">
                      <Box sx={{ width: 7, height: 7, borderRadius: '50%', bgcolor: EMERALD }} />
                      <Typography variant="caption" sx={{ fontSize: 11, fontWeight: 600, color: MIST }}>{getOnlineCount(activeChannelData)} online</Typography>
                    </Stack>
                  )}
                </Stack>
                <Typography variant="caption" sx={{ fontSize: 11, color: MIST }}>
                  {channelType === 'general' ? 'General channel' : channelType === 'group' ? `${chat.channelMembers.length} members` : channelType === 'dm' ? 'Direct message' : ''}
                </Typography>
              </Box>
            </Stack>

            <Stack direction="row" spacing={0.75} alignItems="center">
              {/* Stacked avatars for groups */}
              {(channelType === 'group' || channelType === 'general') && chat.channelMembers.length > 0 && (
                <Stack direction="row" spacing={-0.5} alignItems="center" sx={{ mr: 0.5 }}>
                  {chat.channelMembers.slice(0, 5).map((m, i) => (
                    <Tooltip key={m.user_id} title={`${m.first_name || ''} ${m.last_name || ''}`.trim() || m.email}>
                      <Avatar sx={{
                        width: 26, height: 26, fontSize: 10, bgcolor: BONE, color: NAVY,
                        border: `2px solid ${WHITE}`, ml: i === 0 ? 0 : -0.5, zIndex: 5 - i,
                      }}>
                        {(m.first_name?.[0] || m.email?.[0] || '?').toUpperCase()}
                      </Avatar>
                    </Tooltip>
                  ))}
                  {chat.channelMembers.length > 5 && (
                    <Avatar sx={{ width: 26, height: 26, fontSize: 9, bgcolor: NAVY, color: WHITE, border: `2px solid ${WHITE}`, ml: -0.5 }}>
                      +{chat.channelMembers.length - 5}
                    </Avatar>
                  )}
                </Stack>
              )}

              {channelType !== 'dm' && (
                <IconButton size="small" onClick={() => { setShowMembers(true); chat.loadChannelMembers(chat.activeChannel!) }}
                  disabled={!chat.activeChannel}
                  sx={{ color: NAVY, width: 32, height: 32, border: `1px solid ${HAIRLINE}`, '&:hover': { bgcolor: BONE } }}>
                  <GroupsIcon sx={{ fontSize: 18 }} />
                </IconButton>
              )}
              <IconButton size="small" onClick={() => setDrawerOpen(prev => !prev)}
                sx={{ color: NAVY, width: 32, height: 32, border: `1px solid ${HAIRLINE}`, '&:hover': { bgcolor: BONE } }}>
                <ForumIcon sx={{ fontSize: 18 }} />
              </IconButton>
            </Stack>
          </Box>

          {/* Tabs */}
          {chat.activeChannel && (
            <Box sx={{ borderBottom: `1px solid ${HAIRLINE}`, px: 2, display: 'flex', gap: 0 }}>
              {['Messages', `Files (${chat.sharedFiles.length})`].map((label, i) => (
                <Box key={i} onClick={() => { setActiveTab(i); if (i === 1) chat.loadSharedFiles(chat.activeChannel!) }}
                  sx={{
                    py: 1, px: 1.5, cursor: 'pointer', fontSize: 13, fontWeight: activeTab === i ? 700 : 500,
                    color: activeTab === i ? NAVY : MIST, borderBottom: `2px solid ${activeTab === i ? NAVY : 'transparent'}`,
                    transition: 'all 0.15s',
                  }}>
                  {label}
                </Box>
              ))}
            </Box>
          )}

          {/* Content */}
          {activeTab === 0 ? (
            <>
              <MessageList
                messages={chat.messages} loading={chat.loading}
                hasOlder={chat.hasOlder} olderLoading={chat.olderLoading}
                onLoadOlder={() => chat.loadOlderMessages(chat.activeChannel!)}
                currentUserId={chat.currentUserId} user={chat.user}
                channelType={channelType} otherLastRead={chat.otherLastRead}
                memberReads={chat.memberReads} editingId={chat.editingMessageId}
                editText={chat.editText} onEditTextChange={chat.setEditText}
                onStartEdit={msg => { chat.setEditingMessageId(msg.id); chat.setEditText(msg.content || '') }}
                onSaveEdit={msg => chat.saveEdit(msg)}
                onCancelEdit={() => chat.setEditingMessageId(null)}
                onDelete={msg => setDeleteConfirm(msg)}
                onReact={(msg, emoji) => chat.handleToggleReaction(msg, emoji)}
                onOpenReactionPicker={(e, msgId) => { e.stopPropagation(); setReactionPicker({ msgId, anchor: e.currentTarget as HTMLElement }) }}
                onOpenFile={openFilePreview}
                onReply={msg => { chat.setReplyTo(msg) }}
                typingText={chat.typingText} messagesEndRef={chat.messagesEndRef}
                containerRef={chat.msgContainerRef}
                isMessageSeen={chat.isMessageSeen} getSeenByNames={chat.getSeenByNames}
              />
              <ChatComposer
                messageText={chat.messageText} onTextChange={chat.setMessageText}
                onSend={chat.handleSend} onKeyDown={chat.handleKeyDown}
                onTyping={chat.handleTyping} sending={chat.sending}
                sendError={chat.sendError}
                activeChannel={chat.activeChannel} onFileSelect={handleFileUpload}
                inputLinkPreview={chat.inputLinkPreview} inputLinkLoading={chat.inputLinkLoading}
                replyTo={chat.replyTo} onCancelReply={() => chat.setReplyTo(null)}
                currentUserId={chat.currentUserId}
              />
            </>
          ) : (
            <SharedFiles
              files={chat.sharedFiles} loading={chat.filesLoading}
              onUpload={handleFileUpload} onDelete={chat.handleDeleteFile}
              onOpenFile={openFilePreview} onDownload={handleDownload}
            />
          )}
        </Box>
      </Paper>

      {/* Dialogs */}
      <CreateGroupDialog open={groupDialog} onClose={() => setGroupDialog(false)}
        orgMembers={chat.orgMembers} currentUserId={chat.currentUserId} onCreate={chat.handleCreateGroup} />

      <StartDMDialog open={dmDialog} onClose={() => setDmDialog(false)}
        orgMembers={chat.orgMembers} currentUserId={chat.currentUserId}
        onlineUsers={chat.onlineUsers} onStartDM={chat.handleStartDM} />

      {showMembers && (
        <MemberListDialog open={showMembers} onClose={() => setShowMembers(false)}
          channelName={channelName} members={chat.channelMembers}
          currentUserId={chat.currentUserId} channelType={channelType}
          onlineUsers={chat.onlineUsers}
          onStartDM={id => { chat.handleStartDM(id); setShowMembers(false) }}
          onRemoveMember={chat.handleRemoveMember}
          onLeaveGroup={() => { setLeaveConfirm(true) }} />
      )}

      {/* Reaction picker */}
      <Menu anchorEl={reactionPicker?.anchor} open={!!reactionPicker}
        onClose={() => setReactionPicker(null)}
        slotProps={{ paper: { sx: { maxWidth: 240, p: 0.75, borderRadius: 2 } } }}>
        <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.25, maxHeight: 150, overflow: 'auto' }}>
          {EMOJIS.map(e => (
            <Box key={e} component="span" role="button" tabIndex={0}
              sx={{ cursor: 'pointer', fontSize: 20, lineHeight: 1.4, px: 0.25, '&:hover': { transform: 'scale(1.25)', transition: '0.1s' } }}
              onClick={() => {
                if (reactionPicker) {
                  const msg = chat.messages.find(m => m.id === reactionPicker.msgId)
                  if (msg) chat.handleToggleReaction(msg, e)
                  setReactionPicker(null)
                }
              }}>
              {e}
            </Box>
          ))}
        </Box>
      </Menu>

      {/* Delete confirm */}
      <Dialog open={!!deleteConfirm} onClose={() => setDeleteConfirm(null)} maxWidth="xs" fullWidth>
        <DialogTitle sx={{ fontWeight: 800, fontSize: 15, color: INK }}>Delete message?</DialogTitle>
        <DialogContent>
          <Typography variant="body2" sx={{ color: MIST }}>This cannot be undone.</Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDeleteConfirm(null)} sx={{ color: MIST, fontWeight: 700 }}>Cancel</Button>
          <Button variant="contained" color="error" onClick={() => { chat.confirmDeleteMessage(deleteConfirm); setDeleteConfirm(null) }}>Delete</Button>
        </DialogActions>
      </Dialog>

      {/* Leave group confirm */}
      <Dialog open={leaveConfirm} onClose={() => setLeaveConfirm(false)} maxWidth="xs" fullWidth>
        <DialogTitle sx={{ fontWeight: 800, fontSize: 15, color: INK }}>Leave group?</DialogTitle>
        <DialogContent>
          <Typography variant="body2" sx={{ color: MIST }}>You will no longer see messages here.</Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setLeaveConfirm(false)} sx={{ color: MIST, fontWeight: 700 }}>Cancel</Button>
          <Button variant="contained" color="error" onClick={() => { chat.handleLeaveGroup(); setLeaveConfirm(false) }}>Leave</Button>
        </DialogActions>
      </Dialog>

      {/* Errors */}
      <Snackbar open={!!chat.uploadError} autoHideDuration={4000} onClose={() => chat.setUploadError('')}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}>
        <Alert severity="error" onClose={() => chat.setUploadError('')} variant="filled">{chat.uploadError}</Alert>
      </Snackbar>
    </Box>
  )
}
