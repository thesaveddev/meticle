import { Box, Typography, Button, Container } from '@mui/material'
import { useNavigate } from 'react-router-dom'

export default function NotFoundPage() {
  const navigate = useNavigate()
  return (
    <Box sx={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', bgcolor: '#F8FAFC' }}>
      <Container maxWidth="sm" sx={{ textAlign: 'center' }}>
        <Typography variant="h1" sx={{ fontWeight: 900, color: '#0F4C81', fontSize: '6rem', mb: 2 }}>404</Typography>
        <Typography variant="h5" sx={{ fontWeight: 700, mb: 2 }}>Page Not Found</Typography>
        <Typography sx={{ color: '#6B7280', mb: 4 }}>The page you're looking for doesn't exist or may have been moved.</Typography>
        <Button variant="contained" onClick={() => navigate('/dashboard')} sx={{ bgcolor: '#0F4C81', '&:hover': { bgcolor: '#0A3A5C' } }}>
          Go to Dashboard
        </Button>
      </Container>
    </Box>
  )
}
