import express from 'express';
import cors from 'cors';
import 'dotenv/config';
import routes from './routes';

const app = express();
const port = process.env.PORT || 3001;

app.use(cors());
app.use(express.json());

// Mount all routes at the root
app.use('/', routes);

app.listen(port, () => {
  console.log(`Server is running on port ${port}`);
}); 