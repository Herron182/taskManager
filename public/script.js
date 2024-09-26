const API_BASE_URL = 'http://localhost:3000'; // Adjust the URL as needed

/* authToken will hold the JWT (JSON Web Token) after the user successfully logs in.
Initially, it’s set to null because no user is logged in yet.
Usage: Once the user logs in, the server will return a JWT token, which is then stored in this
authToken variable. This token is then attached to API requests (e.g., to create, update,
or delete tasks) to authenticate the user. It allows the backend to verify that the request is
made by an authorized user */
let authToken = null;
let currentEditTaskId = null;

// Register new user
/* asynchronous allows operations that take longer to complete to complete, such as fetching data
from an API, without blocking the rest of the code from running.
When a function is marked with async, it automatically returns a Promise. This allows you to use "await" 
inside the function to pause execution until the asynchronous task (like a network request) is completed */
/* (e) represents the event object/ argument, which is passed automatically to event handler functions
 (in this case, the "submit" event from the form) */
document.getElementById('register-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const username = document.getElementById('register-username').value;
    const password = document.getElementById('register-password').value;
/* The fetch() function is a built-in JavaScript function used for making network requests to retrieve data
from a server, such as APIs, files, or other resources
EXAMPLE:
fetch(url, options)
    .then(response => {
        // handle response
    })
    .catch(error => {
        // handle error
    });
url: The endpoint you want to request data from.
options (optional): An object that configures details like the HTTP method (GET, POST, etc.)
headers, body data, and more.*/
    try {
        const res = await fetch(`${API_BASE_URL}/register`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username, password }),
        });
        const data = await res.json();
        alert(data.message || 'User registered successfully!');
    } catch (err) {
        console.error(err);
        alert('Registration failed');
    }
});

// User login
document.getElementById('login-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const username = document.getElementById('login-username').value;
    const password = document.getElementById('login-password').value;

    try {
        const res = await fetch(`${API_BASE_URL}/login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username, password }),
        });
        const data = await res.json();
        if (data.token) {
            authToken = data.token;
            fetchTasks();
            alert('Login successful');
            document.getElementById('task-form').style.display = 'block';
            document.getElementById('logout-btn').style.display = 'block';
            document.getElementById('login-form-hide').classList.add('hidden');
            document.getElementById('register-form-hide').classList.add('hidden');
        } else {
            alert('Login failed');
        }
    } catch (err) {
        console.error(err);
        alert('Login failed');
    }
});

// Fetch tasks
async function fetchTasks() {
    try {
        const res = await fetch(`${API_BASE_URL}/tasks`, {
            headers: { Authorization: authToken },
        });
        const tasks = await res.json();
        const taskList = document.getElementById('task-list');
        taskList.innerHTML = ''; // Clear previous tasks
        tasks.forEach(task => {
            const taskElement = document.createElement('div');
            taskElement.classList.add('task-item');
            // If the task is completed, add the 'completed' class for strike-through effect
            if (task.completed) {
                taskElement.classList.add('completed');
            }
            taskElement.innerHTML = `
                <li class="task-item">
                <span class="task-actions">${task.title} - ${task.description} (${task.completed ? 'Completed' : 'Pending'})</span>
                <button class="delete" onclick="deleteTask(${task.id})">Delete</button>
                <button class="edit" onclick="editTask(${task.id}, '${task.title}', '${task.description}')">Edit</button>
                <button class="complete ${task.completed ? 'completed' : 'pending'}"
                 onclick="toggleTaskStatus(${task.id}, ${task.completed})">
                    ${task.completed ? 'Mark as Pending' : 'Mark as Completed'}
                </button>
                </li>
            `;
            taskList.appendChild(taskElement);
        });
    } catch (err) {
        console.error(err);
    }
}

// Toggle task status (Completed or Pending)
async function toggleTaskStatus(taskId, currentStatus) {
    try {
        const updatedStatus = !currentStatus; //Toggle the status
        
        const res = await fetch(`${API_BASE_URL}/tasks/${taskId}/completion`, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json',
                Authorization: authToken,
            },
            body: JSON.stringify({ completed: updatedStatus }),
        });

        if (!res.ok) {
            console.error('Error updating task status:', res.status, res.statusText);
            alert('Failed to update task status');
            return;
        }

        const updatedTask = await res.json();
        console.log('Task completion updated successfully:', updatedTask);
        fetchTasks(); // Refresh the task list
    } catch (err) {
        console.error('Error during request:', err);
        alert('Failed to update task status');
    }
}


// Add new task
document.getElementById('task-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const title = document.getElementById('task-title').value;
    const description = document.getElementById('task-description').value;

    try {
        const res = await fetch(`${API_BASE_URL}/tasks`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                Authorization: authToken,
            },
            body: JSON.stringify({ title, description }),
        });
        if (res.ok) {
            fetchTasks();
            document.getElementById('task-title').value = '';
            document.getElementById('task-description').value = '';
            document.getElementById('task-form').style.display = 'block';
        } else {
            alert('Failed to add task');
        }
    } catch (err) {
        console.error(err);
        alert('Failed to add task');
    }
});

// Delete task
async function deleteTask(taskId) {
    try {
        const res = await fetch(`${API_BASE_URL}/tasks/${taskId}`, {
            method: 'DELETE',
            headers: { Authorization: authToken },
        });
        if (res.ok) {
            fetchTasks(); // Refresh the task list
        } else {
            alert('Failed to delete task');
        }
    } catch (err) {
        console.error(err);
        alert('Failed to delete task');
    }
}

// Edit task
function editTask(taskId, title, description) {
    currentEditTaskId = taskId;
    document.getElementById('edit-task-title').value = title;
    document.getElementById('edit-task-description').value = description;
    
    // Show the edit task form
    document.getElementById('edit-task-section').style.display = 'block';
}

// Update task when the form is submitted
document.getElementById('edit-task-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    
    const newTitle = document.getElementById('edit-task-title').value;
    const newDescription = document.getElementById('edit-task-description').value;

    try {
        const res = await fetch(`${API_BASE_URL}/tasks/${currentEditTaskId}`, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json',
                Authorization: authToken,
            },
            body: JSON.stringify({ title: newTitle, description: newDescription, completed: false }),
        });

        if (res.ok) {
            fetchTasks(); // Refresh the task list
            document.getElementById('edit-task-section').style.display = 'none'; // Hide edit form after update
        } else {
            alert('Failed to update task');
        }
    } catch (err) {
        console.error(err);
        alert('Failed to update task');
    }
});

//Logout
function logout() {
    // Clear authentication token (assuming you're using token-based authentication)
    localStorage.removeItem('authToken'); // or sessionStorage.removeItem('authToken')

    // Hide the task app and logout button
    document.getElementById('task-form').style.display = 'none';
    document.getElementById('task-list').style.display = 'none';
    document.getElementById('logout-btn').style.display = 'none';

    // Show the login and register forms again
    document.getElementById('login-form-hide').classList.remove('hidden');
    document.getElementById('register-form-hide').classList.remove('hidden');
}