import { useState, useCallback } from 'react'
import { Box, Paper, Stack, Avatar, Badge, Typography, Dialog, DialogTitle, DialogContent, DialogActions, Button, Snackbar, Alert, Menu } from '@mui/material'
import { CheckCircle as SuccessIcon, Error as ErrorIcon } from '@mui/icons-material'
import { useChat } from './hooks/useChat'
import { getChannelName, getChannelAvatar, EMOJIS, NAVY, NAVY_DEEP, EMERALD, INK, MIST, BONE, HAIRLINE, OUTLINE, WHITE } from './utils'
import ChannelSidebar from './components/ChannelSidebar'
import MessageList from './components/MessageList'
import ChatComposer from './components/ChatComposer'
import SharedFiles from './components/SharedFiles'
import CreateGroupDialog from './components/CreateGroupDialog'
import StartDMDialog from './components/StartDMDialog'
import MemberListDialog from './components/MemberListDialog'
import ShareFileDialog from './components/ShareFileDialog'

const ROLE_LABELS: Record<string, string> = {
  ORG_ADMIN: 'Admin', MANAGER: 'Manager', CARE_WORKER: 'Care Worker', COMPLIANCE_OFFICER: 'Compliance',
}

export default function ChatPage() {
  const chat = useChat()
  const [activeTab, setActiveTab] = useState(0)
  const [showMembers, setShowMembers] = useState(false)
  const [groupDialog, setGroupDialog] = useState(false)
  const [dmDialog, setDmDialog] = useState(false)
  const [deleteConfirm, setDeleteConfirm] = useState<any>(null)
  const [leaveConfirm, setLeaveConfirm] = useState(false)
  const [shareDialog, setShareDialog] = useState(false)
  const [toast, setToast] = useState<{ message: string; kind: 'success' | 'error' } | null>(null)
  const [reactionPicker, setReactionPicker] = useState<{ msgId: string; anchor: HTMLElement } | null>(null)

  const showToast = useCallback((message: string, kind: 'success' | 'error') => setToast({ message, kind }), [])

  const activeChannelData = chat.activeChannelData
  const channelType = activeChannelData?.type || ''
  const channelName = activeChannelData ? getChannelName(activeChannelData, chat.currentUserId) : ''
  const { initials: channelInitials, avatar: channelAvatar } = activeChannelData
    ? getChannelAvatar(activeChannelData, chat.currentUserId)
    : { initials: '?', avatar: '' }

  const getOnlineCount = useCallback((ch: any) => ch?.members ? ch.members.filter((m: any) => chat.onlineUsers.has(m.user_id)).length : 0, [chat.onlineUsers])

  const dmOther = channelType === 'dm' && activeChannelData?.members
    ? activeChannelData.members.find((m: any) => m.user_id !== chat.currentUserId)
    : null
  const dmOnline = dmOther ? chat.onlineUsers.has(dmOther.user_id) : false
  const dmRoleValue = (dmOther as any)?.role as string | undefined
  const dmRole = dmRoleValue ? ROLE_LABELS[dmRoleValue] || dmRoleValue.replace(/_/g, ' ') : ''
  const memberCount = activeChannelData?.members?.length || 0
  const headerSubtitle = channelType === 'dm'
    ? `${dmOnline ? 'Online' : 'Away'}${dmRole ? ` · ${dmRole}` : ''}`
    : (channelType === 'general' || channelType === 'group')
      ? `${memberCount} ${memberCount === 1 ? 'person' : 'people'} · ${getOnlineCount(activeChannelData)} online`
      : ''
  const emptySubtitle = channelType === 'dm' && dmOther
    ? `Say hello to ${(dmOther.first_name || 'them').trim()}. Messages here are only seen by the two of you.`
    : undefined

  const handleDownload = useCallback(async (url: string, name: string) => {
    try {
      // Same-origin request: the session cookie authenticates it.
      const res = await fetch(url)
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

  const handleRemoveMember = useCallback(async (userId: string) => {
    try {
      await chat.handleRemoveMember(userId)
    } catch {
      showToast('Could not remove member. Try again.', 'error')
    }
  }, [chat.handleRemoveMember, showToast])

  const handleAddMembers = useCallback(async (userIds: string[]): Promise<number> => {
    try {
      const added = await chat.handleAddMembers(userIds)
      showToast(added > 0 ? `${added} ${added === 1 ? 'person' : 'people'} added to the group` : 'Everyone selected is already in this group', 'success')
      return added
    } catch {
      showToast('Could not add members. Try again.', 'error')
      return 0
    }
  }, [chat.handleAddMembers, showToast])

  const handleStartDM = useCallback(async (userId: string) => {
    try {
      await chat.handleStartDM(userId)
    } catch {
      showToast('Could not start conversation. Try again.', 'error')
    }
  }, [chat.handleStartDM, showToast])

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', height: 'calc(100vh - 112px)', overflow: 'hidden', gap: 2 }}>
      <Box>
        <Typography variant="caption" sx={{ color: NAVY, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase' }}>
          Communication / Chat
        </Typography>
        <Typography variant="h5" fontWeight={600} sx={{ mt: 0.5 }}>Communication</Typography>
        <Typography variant="body2" color="text.secondary">Messages between the team, in groups or one to one.</Typography>
      </Box>
      <Box sx={{ flex: 1, minHeight: 0, display: 'flex', gap: 2, overflow: 'hidden' }}>
        <ChannelSidebar
          channels={chat.channels} activeChannel={chat.activeChannel}
          onSelectChannel={id => { chat.setActiveChannel(id); setActiveTab(0) }}
          orgMembers={chat.orgMembers} onlineUsers={chat.onlineUsers}
          totalUnread={chat.totalUnread} searchQuery={chat.searchQuery}
          onSearchChange={chat.setSearchQuery} searchResults={chat.searchResults}
          searching={chat.searching} currentUserId={chat.currentUserId}
          onNewDM={() => setDmDialog(true)} onNewGroup={() => setGroupDialog(true)}
        />

        {/* Main area */}
        <Paper elevation={0} sx={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', overflow: 'hidden', bgcolor: WHITE, borderRadius: 3, border: `1px solid ${HAIRLINE}` }}>
          {/* Header */}
          <Box sx={{ px: 2, py: 1.25, borderBottom: `1px solid ${HAIRLINE}`, display: 'flex', alignItems: 'center', justifyContent: 'space-between', bgcolor: WHITE, minHeight: 52, boxShadow: '0 1px 3px rgba(0,0,0,0.03)' }}>
            <Stack direction="row" spacing={1.5} alignItems="center">
              {(channelType === 'general' || channelType === 'group') ? (
                <Avatar sx={{
                  bgcolor: NAVY, color: WHITE, borderRadius: 1.5,
                  border: `1px solid ${NAVY_DEEP}`,
                  width: 38, height: 38, fontSize: 16,
                }}>
                  #
                </Avatar>
              ) : (
                <Badge
                  overlap="circular"
                  anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
                  badgeContent={dmOther && dmOnline ? <Box sx={{ width: 11, height: 11, bgcolor: EMERALD, borderRadius: '50%', border: `2px solid ${WHITE}` }} /> : null}
                >
                  <Avatar src={channelAvatar || undefined}
                    sx={{ bgcolor: BONE, color: NAVY, border: `1px solid ${HAIRLINE}`, width: 38, height: 38, fontSize: 14 }}>
                    {channelInitials}
                  </Avatar>
                </Badge>
              )}
              <Box>
                <Stack direction="row" spacing={0.75} alignItems="center">
                  <Typography variant="subtitle2" fontWeight={600} sx={{ fontSize: 14, color: INK }}>
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
                  {channelName ? headerSubtitle : 'Choose a conversation to get started'}
                </Typography>
              </Box>
            </Stack>

            <Stack direction="row" spacing={0.75} alignItems="center">
              {(channelType === 'group' || channelType === 'general') && chat.activeChannel && (
                <Button variant="outlined" size="small"
                  onClick={() => { setShowMembers(true); chat.loadChannelMembers(chat.activeChannel!) }}
                  sx={{ textTransform: 'none', fontWeight: 600, borderRadius: 2 }}>
                  Members
                </Button>
              )}
            </Stack>
          </Box>

          {/* Tabs */}
          {chat.activeChannel && (
            <Box sx={{ borderBottom: `1px solid ${OUTLINE}`, px: 2, display: 'flex', gap: 0 }}>
              {['Messages', `Files ${chat.sharedFiles.length}`].map((label, i) => (
                <Box key={i} onClick={() => { setActiveTab(i); if (i === 1) chat.loadSharedFiles(chat.activeChannel!) }}
                  sx={{
                    py: 1, px: 2, cursor: 'pointer', fontSize: 13, fontWeight: activeTab === i ? 700 : 500,
                    color: activeTab === i ? NAVY : MIST, borderBottom: `2px solid ${activeTab === i ? NAVY : 'transparent'}`,
                    transition: 'all 0.15s', borderRadius: '4px 4px 0 0',
                    '&:hover': { color: NAVY, bgcolor: activeTab === i ? 'transparent' : BONE },
                  }}>
                  {label}
                </Box>
              ))}
            </Box>
          )}

          {/* Content */}
          {chat.sendError && (
            <Box sx={{ mx: 2, mt: 1.5, p: 1.5, borderRadius: 2, bgcolor: '#EAF2FB', borderLeft: `3px solid ${NAVY}`, display: 'flex', gap: 1.5, alignItems: 'center' }}>
              <Box sx={{ flex: 1, minWidth: 0 }}>
                <Typography variant="body2" fontWeight={700}>You're offline</Typography>
                <Typography variant="caption" color="text.secondary">Your message is saved here. It will send when you're back online, or tap Try again.</Typography>
              </Box>
              <Button size="small" variant="outlined" onClick={() => chat.handleSend()} sx={{ textTransform: 'none', fontWeight: 600, flexShrink: 0, borderRadius: 2 }}>
                Try again
              </Button>
            </Box>
          )}
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
                emptySubtitle={emptySubtitle}
              />
              <ChatComposer
                messageText={chat.messageText} onTextChange={chat.setMessageText}
                onSend={chat.handleSend} onKeyDown={chat.handleKeyDown}
                onTyping={chat.handleTyping} sending={chat.sending}
                sendError={chat.sendError}
                activeChannel={chat.activeChannel} onAttachClick={() => setShareDialog(true)}
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
        </Paper>
      </Box>

      {/* Dialogs */}
      <CreateGroupDialog open={groupDialog} onClose={() => setGroupDialog(false)}
        orgMembers={chat.orgMembers} currentUserId={chat.currentUserId} onCreate={chat.handleCreateGroup}
        onCreated={() => showToast('Group created', 'success')}
        onFailed={() => showToast('Group failed to create. Try again.', 'error')} />

      <StartDMDialog open={dmDialog} onClose={() => setDmDialog(false)}
        orgMembers={chat.orgMembers} currentUserId={chat.currentUserId}
        onlineUsers={chat.onlineUsers} onStartDM={handleStartDM} />

      <ShareFileDialog open={shareDialog} onClose={() => setShareDialog(false)}
        channelName={channelName} onSendFile={chat.handleSendFile}
        onSent={() => showToast('File shared', 'success')}
        onFailed={() => showToast('File failed to share. Try again.', 'error')} />

      {showMembers && (
        <MemberListDialog open={showMembers} onClose={() => setShowMembers(false)}
          channelName={channelName} members={chat.channelMembers}
          orgMembers={chat.orgMembers}
          currentUserId={chat.currentUserId} channelType={channelType}
          onlineUsers={chat.onlineUsers}
          onStartDM={id => { handleStartDM(id); setShowMembers(false) }}
          onRemoveMember={handleRemoveMember}
          onAddMembers={handleAddMembers}
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
        <DialogTitle sx={{ fontWeight: 600, fontSize: 15, color: INK }}>Delete message?</DialogTitle>
        <DialogContent>
          <Typography variant="body2" sx={{ color: MIST }}>This cannot be undone.</Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDeleteConfirm(null)} sx={{ color: MIST, fontWeight: 600 }}>Cancel</Button>
          <Button variant="contained" color="error" onClick={() => { chat.confirmDeleteMessage(deleteConfirm); setDeleteConfirm(null) }}>Delete</Button>
        </DialogActions>
      </Dialog>

      {/* Leave group confirm */}
      <Dialog open={leaveConfirm} onClose={() => setLeaveConfirm(false)} maxWidth="xs" fullWidth>
        <DialogTitle sx={{ fontWeight: 600, fontSize: 15, color: INK }}>Leave group?</DialogTitle>
        <DialogContent>
          <Typography variant="body2" sx={{ color: MIST }}>You will no longer see messages here.</Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setLeaveConfirm(false)} sx={{ color: MIST, fontWeight: 600 }}>Cancel</Button>
          <Button variant="contained" color="error" onClick={() => { chat.handleLeaveGroup(); setLeaveConfirm(false) }}>Leave</Button>
        </DialogActions>
      </Dialog>

      {/* Errors */}
      <Snackbar open={!!chat.uploadError} autoHideDuration={4000} onClose={() => chat.setUploadError('')}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}>
        <Alert severity="error" onClose={() => chat.setUploadError('')} variant="filled">{chat.uploadError}</Alert>
      </Snackbar>

      {/* Success / failure toasts (Figma 7.4) */}
      <Snackbar open={!!toast} autoHideDuration={4000} onClose={() => setToast(null)}
        anchorOrigin={{ vertical: 'top', horizontal: 'right' }}>
        <Box sx={{
          display: 'flex', alignItems: 'center', gap: 1,
          bgcolor: NAVY_DEEP, color: WHITE, borderRadius: 999,
          px: 2, py: 1, fontSize: 13, fontWeight: 600,
          boxShadow: '0 4px 16px rgba(0,0,0,0.25)',
        }}>
          {toast?.kind === 'success'
            ? <SuccessIcon sx={{ fontSize: 18, color: EMERALD }} />
            : <ErrorIcon sx={{ fontSize: 18, color: '#FCA5A5' }} />}
          {toast?.message}
        </Box>
      </Snackbar>
    </Box>
  )
}
