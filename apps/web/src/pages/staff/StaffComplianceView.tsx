import { useState } from 'react'
import { Box, Typography, Button, TextField, MenuItem, Dialog, DialogTitle, DialogContent, DialogActions } from '@mui/material'
import { useForm } from 'react-hook-form'
import api from '../../services/api'

export default function StaffComplianceView({ staffId }: { staffId: string }) {
  const [open, setOpen] = useState(false)
  const { register, handleSubmit } = useForm()

  const onUpload = async (data: any) => {
    const formData = new FormData()
    formData.append('document', data.document[0])
    formData.append('staffId', staffId)
    formData.append('type', data.type)
    formData.append('expiryDate', data.expiryDate)

    try {
      await api.post('/compliance/upload', formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      })
      setOpen(false)
      // Refetch logic
    } catch (error) {
      console.error('Upload failed', error)
    }
  }

  return (
    <Box>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 2 }}>
        <Typography variant="h6">Compliance Documents</Typography>
        <Button variant="contained" onClick={() => setOpen(true)}>Upload Document</Button>
      </Box>

      <Dialog open={open} onClose={() => setOpen(false)}>
        <DialogTitle>Upload New Document</DialogTitle>
        <DialogContent>
          <Box component="form" sx={{ mt: 1 }}>
            <TextField
              fullWidth
              select
              label="Document Type"
              margin="normal"
              {...register('type', { required: true })}
            >
              <MenuItem value="DBS">DBS Check</MenuItem>
              <MenuItem value="PASSPORT">Passport</MenuItem>
              <MenuItem value="VISA">Visa</MenuItem>
              <MenuItem value="RIGHT_TO_WORK">Right to Work</MenuItem>
            </TextField>
            <TextField
              fullWidth
              type="date"
              label="Expiry Date"
              margin="normal"
              InputLabelProps={{ shrink: true }}
              {...register('expiryDate', { required: true })}
            />
            <input
              type="file"
              style={{ marginTop: '16px' }}
              {...register('document', { required: true })}
            />
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setOpen(false)}>Cancel</Button>
          <Button onClick={handleSubmit(onUpload)} variant="contained">Upload</Button>
        </DialogActions>
      </Dialog>

      {/* List of documents would go here */}
    </Box>
  )
}
