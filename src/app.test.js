const axios = require('axios');

describe('Task API', () => {
  let taskId;

  test('should fetch all tasks', async () => {
    const res = await axios.get('http://localhost:3000/api/tasks');
    expect(res.status).toBe(200);
    expect(Array.isArray(res.data)).toBe(true);
  });

  test('should create a new task', async () => {
    const newTask = {
      title: 'Test Task',
      description: 'Test Description',
      deadline: new Date().toISOString(),
      category: 'Test',
      priority: 'High'
    };
    const res = await axios.post('http://localhost:3000/api/tasks', newTask);
    expect(res.status).toBe(201);
    expect(res.data.title).toBe('Test Task');
    taskId = res.data.id;
  });

  test('should update task status', async () => {
    const res = await axios.put(`http://localhost:3000/api/tasks/${taskId}`, { completed: true });
    expect(res.status).toBe(200);
    expect(res.data.completed).toBe(true);
  });

  test('should fetch dashboard stats', async () => {
    const res = await axios.get('http://localhost:3000/api/stats');
    expect(res.status).toBe(200);
    expect(res.data).toHaveProperty('total');
    expect(res.data).toHaveProperty('completed');
    expect(res.data).toHaveProperty('pending');
  });
});
