import express from 'express';
import cors from 'cors';
const app = express();

// TODO: Restrict CORS to only allow requests from the frontend
app.use(cors())

app.get("/", (req, res) => {
    res.json({
        success: true,
        message: "success.hello_world"
    });
})

app.listen(3001, (error) => {
    if (error) {
        console.error('Error starting server:', error);
        return;
    }
    console.log('Server is running on port 3001');
})