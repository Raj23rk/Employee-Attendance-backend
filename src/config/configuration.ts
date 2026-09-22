export default () => ({
  port: parseInt(process.env.PORT, 10) || 5000,
  database: {
    url: process.env.DATABASE_URL || 'mongodb+srv://Raj:iT3Wqx0axmZv1dHI@cluster0.86ttxfk.mongodb.net/Attendence_management?appName=Cluster0',
  },
  jwt: {
    secret: process.env.JWT_SECRET || 'superSecretAttendanceJwtKey2026!RajWegrowPortal',
    expiresIn: process.env.JWT_EXPIRES_IN || '7d',
  },
  resend: {
    apiKey: process.env.RESEND_API_KEY || 're_demo_placeholder_key',
  },
  frontendUrl: process.env.FRONTEND_URL || 'http://localhost:5173',
});
