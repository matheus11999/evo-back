const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const prisma = require('../utils/prisma');

const router = express.Router();

router.post('/register', async (req, res) => {
  try {
    const { username, password } = req.body;

    const existingUser = await prisma.user.findUnique({
      where: { username }
    });

    if (existingUser) {
      return res.status(400).json({ error: 'Usuário já existe' });
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    const user = await prisma.user.create({
      data: {
        username,
        password: hashedPassword
      }
    });

    const token = jwt.sign({ userId: user.id }, process.env.JWT_SECRET, { expiresIn: '7d' });

    res.json({ token, user: { id: user.id, username: user.username } });
  } catch (error) {
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
});

router.post('/login', async (req, res) => {
  try {
    const { username, password } = req.body;

    const user = await prisma.user.findUnique({
      where: { username }
    });

    if (!user) {
      return res.status(400).json({ error: 'Credenciais inválidas' });
    }

    const isValidPassword = await bcrypt.compare(password, user.password);

    if (!isValidPassword) {
      return res.status(400).json({ error: 'Credenciais inválidas' });
    }

    const token = jwt.sign({ userId: user.id }, process.env.JWT_SECRET, { expiresIn: '7d' });

    res.json({ token, user: { id: user.id, username: user.username } });
  } catch (error) {
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
});

router.post('/validate', async (req, res) => {
  try {
    const token = req.header('Authorization')?.replace('Bearer ', '');
    
    if (!token) {
      return res.status(401).json({ error: 'Token não fornecido' });
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const user = await prisma.user.findUnique({
      where: { id: decoded.userId }
    });

    if (!user) {
      return res.status(401).json({ error: 'Usuário não encontrado' });
    }

    res.json({ user: { id: user.id, username: user.username } });
  } catch (error) {
    res.status(401).json({ error: 'Token inválido' });
  }
});

module.exports = router;