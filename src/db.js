import mysql from('mysql2/promise');
import dotenv from "dotenv";

dotenv.config();

const pool = mysql.createPool({
  host: process.env.DB_HOST || 'localhost',
  port: Number(process.env.DB_PORT || 3306),
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_NAME || undefined,
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0
});

async function testearConexion() {
  try {
       const conecction = await pool.getConnection();
       console.log('conection succefully');
       conecction.release();
  } catch (error) {
    console.log("error al conectar a la base de datos");
  }
  
  }
