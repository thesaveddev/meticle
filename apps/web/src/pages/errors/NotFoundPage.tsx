import { Box, Typography, Button, Container } from '@mui/material'
import { useNavigate } from 'react-router-dom'
import PageMeta from '../../components/PageMeta'

export default function NotFoundPage() {
  const navigate = useNavigate()
  return (
    <>
      <PageMeta title="Page Not Found | Meticle Care" description="The page you are looking for does not exist." noindex />
      <Box sx={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', bgcolor: 'notice.subtle.bg' }}>
        <Container maxWidth="sm" sx={{ textAlign: 'center' }}>
          <Typography variant="h1" sx={{ fontWeight: 900, color: '#2F80ED', fontSize: '6rem', mb: 2 }}>404</Typography>
          <Typography variant="h5" sx={{ fontWeight: 700, mb: 2 }}>Page Not Found</Typography>
          <Typography sx={{ color: '#667085', mb: 4 }}>The page you are looking for does not exist or may have been moved.</Typography>
          <Button variant="contained" onClick={() => navigate('/')} sx={{ bgcolor: '#2F80ED', '&:hover': { bgcolor: '#1F68C7' } }}>
            Back to Home
          </Button>
        </Container>
      </Box>
    </>
  )
}
