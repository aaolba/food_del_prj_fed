const request = require('supertest');
const express = require('express');

// Mock app for testing
const app = express();

app.get('/health', (req, res) => {
  res.status(200).json({ status: 'healthy', message: 'Server is running' });
});

describe('Health Check API', () => {
  test('GET /health should return 200', async () => {
    const response = await request(app).get('/health');
    expect(response.status).toBe(200);
    expect(response.body).toHaveProperty('status', 'healthy');
  });

  test('GET /health should have correct structure', async () => {
    const response = await request(app).get('/health');
    expect(response.body).toHaveProperty('status');
    expect(response.body).toHaveProperty('message');
  });
});
