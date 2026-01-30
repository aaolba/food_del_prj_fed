const jwt = require('jsonwebtoken');

// Mock auth middleware
const authMiddleware = async (req, res, next) => {
  const { token } = req.headers;
  
  if (!token) {
    return res.json({ success: false, message: "Not Authorized. Login Again" });
  }
  
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'test-secret');
    req.body.userId = decoded.id;
    next();
  } catch (error) {
    res.json({ success: false, message: "Error" });
  }
};

describe('Auth Middleware', () => {
  let mockReq, mockRes, mockNext;

  beforeEach(() => {
    mockReq = { headers: {}, body: {} };
    mockRes = {
      json: jest.fn(),
      status: jest.fn().mockReturnThis()
    };
    mockNext = jest.fn();
    process.env.JWT_SECRET = 'test-secret';
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  test('should return error if no token provided', async () => {
    await authMiddleware(mockReq, mockRes, mockNext);
    expect(mockRes.json).toHaveBeenCalledWith({
      success: false,
      message: "Not Authorized. Login Again"
    });
    expect(mockNext).not.toHaveBeenCalled();
  });

  test('should call next with valid token', async () => {
    const token = jwt.sign({ id: 'user123' }, 'test-secret');
    mockReq.headers.token = token;
    
    await authMiddleware(mockReq, mockRes, mockNext);
    expect(mockReq.body.userId).toBe('user123');
    expect(mockNext).toHaveBeenCalled();
  });

  test('should return error with invalid token', async () => {
    mockReq.headers.token = 'invalid-token';
    
    await authMiddleware(mockReq, mockRes, mockNext);
    expect(mockRes.json).toHaveBeenCalledWith({
      success: false,
      message: "Error"
    });
  });
});
