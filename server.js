const express = require('express');
const bodyParser = require('body-parser');
const { Pool } = require('pg');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const dotenv = require('dotenv');
const path = require('path');

// Load environment variables
dotenv.config()

//Initalize express app
const app = express();
app.use(bodyParser.json());

// Serve static files from the 'public' directory
app.use(express.static(path.join(__dirname, 'public')));

// Logging middleware here
app.use((req, res, next) => {
  console.log('Middleware hit!');
  console.log(`${req.method} request for '${req.url}'`);
  next();
});

// PostgreSQL connection pool
const pool = new Pool({
    user: process.env.DB_USER,
    host: process.env.DB_HOST,
    database: process.env.DB_NAME,
    password: process.env.DB_PASSWORD,
    port: process.env.DB_PORT,
});

// Middleware to verify JWT token
const authenticateToken = (req, res, next) => {
    const token = req.headers['authorization'];
    if (!token) return res.status(403).send('Token is required');
    
    jwt.verify(token, process.env.JWT_SECRET, (err, user) => {
        if (err) return res.status(403).send('Invalid token');
        req.user = user;
        next();
    });       
};

/*The following code snippet defines an API endpoint for registering new users in your to-do list app.
It uses Express to handle the HTTP POST request, bcrypt to hash user passwords,
and PostgreSQL (through pool.query) to store the user information in the database.*/


/* Register a new user using a HTTP POST Request, async as we are performing asynchronous operations
(hashing the password and querying the database).*/ 
app.post('/register', async (req, res) => {
    const { username, password } = req.body;
  
    try {
    /* Hash the password before saving to a database. Before storing the password in the database,
    it is hashed using bcrypt to ensure it’s securely stored. The bcrypt.hash(password, 10) function
    hashes the user's password with a salt factor of 10. The salt is random data added to the hash process,
    making the stored password more secure against brute-force attacks */
      const hashedPassword = await bcrypt.hash(password, 10);
    /*Database Query: This line inserts the new user into the users table in the PostgreSQL database.
    $1 and $2 are placeholders that are substituted with username and hashedPassword, respectively,
    to prevent SQL injection attacks. RETURNING * returns the inserted row from the database
    (including the newly created user ID) after the insertion is successful.
    pool.query is an asynchronous function, hence the await. It runs the SQL query using PostgreSQL
    connection pooling to interact with the database efficiently.*/   
      const result = await pool.query(
        'INSERT INTO users (username, password) VALUES ($1, $2) RETURNING *',
        [username, hashedPassword]
      );
      // Success response/ error handling
      res.status(201).json({ message: 'User registered', user: result.rows[0] });
    } catch (err) {
      console.error(err.message);
      res.status(500).send('Server error');
    }
  });

// Login user and generate JWT
app.post('/login', async (req, res) => {
  const { username, password } = req.body;

  try {
    const result = await pool.query('SELECT * FROM users WHERE username = $1', [username]);
    if (result.rows.length === 0) return res.status(400).send('User not found');

    const user = result.rows[0];
    const isPasswordValid = await bcrypt.compare(password, user.password);
    if (!isPasswordValid) return res.status(400).send('Incorrect password');

    // Generate JWT token
    const token = jwt.sign({ userId: user.id }, process.env.JWT_SECRET, { expiresIn: '1h' });
    res.json({ token });
  } catch (err) {
    console.error(err.message);
    res.status(500).send('Server error');
  }
});

// Get all tasks for logged-in user

app.get('/tasks', authenticateToken, async (req, res) => {
  try {
    /* The SQL statement SELECT * FROM tasks WHERE user_id = $1 
    retrieves all rows from the tasks table where user_id matches
    the provided value. The $1 is a placeholder used for parameterized
    queries to prevent SQL injection.
    [req.user.userId]: This is the value that replaces $1 in the SQL query.
    req.user.userId comes from the authenticateToken middleware, which
    extracts user data from the JWT. */
    /* await: Since pool.query is an asynchronous operation (it involves
    communication with the database), await is used to wait for the query
    to complete before moving on */ 
    const result = await pool.query('SELECT * FROM tasks WHERE user_id = $1', [req.user.userId]);
    res.json(result.rows);
  } catch (err) {
    console.error(err.message);
    res.status(500).send('Server error');
  }
});

// Create a new task
app.post('/tasks', authenticateToken, async (req, res) => {
  const { title, description } = req.body;
    try {
      const result = await pool.query(
        'INSERT INTO tasks (user_id, title, description) VALUES ($1, $2, $3) RETURNING *',
        [req.user.userId, title, description]
      );
      res.status(201).json(result.rows[0]);
    } catch (err) {
      console.error(err.message);
      res.status(500).send('Server error');
    }
  });
 
// Update a task
/*app.put('/tasks/:id'): This line defines an HTTP PUT request at the /tasks/:id endpoint.
The :id is a route parameter that represents the ID of the task you want to update.*/ 
app.put('/tasks/:id', authenticateToken, async (req, res) => {
/* req.params: This object contains route parameters (in this case, id), which are extracted
from the URL. const { id } = req.params; retrieves the id of the task to be updated */
  const { id } = req.params;
/* req.body: This object contains data sent by the client in the request body. The line
const { title, description, completed } = req.body; extracts the fields title, description,
and completed from the body of the request. These are the new values for the task */
  const { title, description, completed } = req.body;

  try {
/* Database Query:
pool.query: This line executes an SQL query using the PostgreSQL connection pool.
SQL Statement: UPDATE tasks SET title = $1, description = $2, completed = $3
 WHERE id = $4 AND user_id = $5 RETURNING *: This SQL query updates the tasks table by setting
the values of title, description, and completed for a specific task where the id and user_id match.
$1, $2, $3, $4, $5 are placeholders for parameterized queries to safely inject the new values into
the SQL statement. This practice helps prevent SQL injection.
Parameters: [title, description, completed, id, req.user.userId]: These values replace the placeholders
in the SQL query. title, description, completed are the new values for the task.
id is the ID of the task being updated, extracted from req.params.
req.user.userId is the ID of the logged-in user, extracted from the JWT token by the authenticateToken
middleware. This ensures the user can only update their own tasks. */
    const result = await pool.query(
      'UPDATE tasks SET title = $1, description = $2, completed = $3 WHERE id = $4 AND user_id = $5 RETURNING *',
      [title, description, completed, id, req.user.userId]
    );
    /* if (result.rows.length === 0): This checks if the update query affected any rows.
    If no rows were updated, it means either the task with the specified id does not exist
    or the task does not belong to the authenticated user */
    if (result.rows.length === 0) return res.status(404).send('Task not found');
    /* res.json(result.rows[0]);: If the update was successful, the RETURNING * clause in the
    SQL statement returns the updated task. result.rows[0] contains the updated task object,
    which is then sent back to the client as a JSON response */
    res.json(result.rows[0]);
  } catch (err) {
    console.error(err.message);
    res.status(500).send('Server error');
  }
});  

app.put('/tasks/:id/completion', authenticateToken, async (req, res) => {
  const { id } = req.params;
  const { completed } = req.body;

  try {
      // Fetch the task by ID and user ID (from the authenticated token)
      const taskQuery = await pool.query('SELECT * FROM tasks WHERE id = $1 AND user_id = $2', [id, req.user.userId]);

      // If the task is not found, return a 404 error
      if (taskQuery.rows.length === 0) {
          return res.status(404).json({ message: 'Task not found' });
      }

      // Update the completion status of the task
      const updatedTaskQuery = await pool.query(
          'UPDATE tasks SET completed = $1 WHERE id = $2 AND user_id = $3 RETURNING *',
          [completed, id, req.user.userId]
      );

      // Return the updated task
      const updatedTask = updatedTaskQuery.rows[0];
      res.json(updatedTask);
  } catch (err) {
      console.error('Error updating task completion:', err.message);
      res.status(500).json({ message: 'Server error' });
  }
});


// Delete a task
app.delete('/tasks/:id', authenticateToken, async (req, res) => {
  /* This line extracts the id parameter from the URL (e.g., /tasks/123),
  which indicates the specific task the user wants to delete */
  const { id } = req.params;

  try {
    const result = await pool.query('DELETE FROM tasks WHERE id = $1 AND user_id = $2 RETURNING *', [id, req.user.userId]);
    if (result.rows.length === 0) return res.status(404).send('Task not found');
    res.send('Task deleted');
  } catch (err) {
    console.error(err.message);
    res.status(500).send('Server error');
  }
});

  //Start the server
  app.listen(3000, () => console.log('listening on port 3000'))