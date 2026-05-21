import { createClient } from '@supabase/supabase-js'

// REPLACE WITH YOUR ACTUAL SUPABASE KEYS
const SUPABASE_URL = 'https://qwccytuozszeifaqepes.supabase.co'
const SUPABASE_PUBLISHABLE_KEY = 'sb_publishable_7SJ1iD9fqEBrGVEey7BNtw_sLgTytVR'

const supabase = createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY)

// DOM Elements
const authSection = document.getElementById('auth-section')
const feedSection = document.getElementById('feed-section')
const loginForm = document.getElementById('login-form')
const signupForm = document.getElementById('signup-form')
const authMessage = document.getElementById('auth-message')

// Login elements
const loginUsername = document.getElementById('login-username')
const loginPassword = document.getElementById('login-password')
const loginBtn = document.getElementById('login-btn')
const showSignupBtn = document.getElementById('show-signup-btn')

// Signup elements
const signupUsername = document.getElementById('signup-username')
const signupPassword = document.getElementById('signup-password')
const signupBtn = document.getElementById('signup-btn')
const backToLoginBtn = document.getElementById('back-to-login-btn')
const suggestUsernameBtn = document.getElementById('suggest-username-btn')
const suggestionDisplay = document.getElementById('suggestion-display')

// Feed elements
const currentUsernameSpan = document.getElementById('current-username')
const logoutBtn = document.getElementById('logout-btn')
const postContent = document.getElementById('post-content')
const postBtn = document.getElementById('post-btn')
const feedDiv = document.getElementById('feed')
const charCount = document.getElementById('char-count')

// State
let currentUser = null

// Helper: Show message in auth section
function showAuthMessage(text, isError = true) {
    authMessage.textContent = text
    authMessage.className = `message ${isError ? 'error' : 'success'}`
    setTimeout(() => {
        authMessage.textContent = ''
        authMessage.className = 'message'
    }, 3000)
}

// Helper: Generate random username
function generateRandomUsername() {
    const adjectives = ['brave', 'calm', 'deep', 'fast', 'kind', 'quiet', 'smart', 'wild', 'young', 'old']
    const nouns = ['cat', 'dog', 'bird', 'tree', 'star', 'cloud', 'moon', 'sun', 'fox', 'wolf']
    const numbers = Math.floor(Math.random() * 1000)
    const adj = adjectives[Math.floor(Math.random() * adjectives.length)]
    const noun = nouns[Math.floor(Math.random() * nouns.length)]
    return `${adj}_${noun}_${numbers}`
}

// Suggest random username
suggestUsernameBtn.addEventListener('click', () => {
    const suggested = generateRandomUsername()
    signupUsername.value = suggested
    suggestionDisplay.textContent = `✨ Suggested: ${suggested}`
    setTimeout(() => {
        suggestionDisplay.textContent = ''
    }, 3000)
})

// Check if username is available
async function isUsernameAvailable(username) {
    const { data, error } = await supabase
        .from('profiles')
        .select('username')
        .eq('username', username)
        .single()
    
    return !data // Returns true if no user found with that username
}

// Sign Up
async function signUp() {
    const username = signupUsername.value.trim()
    const password = signupPassword.value
    
    if (!username || !password) {
        showAuthMessage('Please enter both username and password')
        return
    }
    
    if (password.length < 6) {
        showAuthMessage('Password must be at least 6 characters')
        return
    }
    
    if (!/^[a-zA-Z0-9_]+$/.test(username)) {
        showAuthMessage('Username can only contain letters, numbers, and underscores')
        return
    }
    
    // Check availability
    const available = await isUsernameAvailable(username)
    if (!available) {
        showAuthMessage('Username already taken. Try another one.')
        return
    }
    
    // Create user in Supabase Auth (email is username@anonymous.local)
    const fakeEmail = `${username}@anon.com`
    
    const { data, error } = await supabase.auth.signUp({
        email: fakeEmail,
        password: password,
        options: {
            data: {
                username: username,
                display_name: username
            }
        }
    })
    
    if (error) {
        showAuthMessage(error.message)
        return
    }
    
    if (data.user) {
        // Create profile entry
        const { error: profileError } = await supabase
            .from('profiles')
            .insert([{
                id: data.user.id,
                username: username,
                created_at: new Date()
            }])
        
        if (profileError) {
            console.error('Profile creation error:', profileError)
        }
        
        showAuthMessage('Account created! You can now sign in.', false)
        // Switch to login form
        signupForm.style.display = 'none'
        loginForm.style.display = 'block'
        signupUsername.value = ''
        signupPassword.value = ''
    }
}

// Sign In
async function signIn() {
    const username = loginUsername.value.trim()
    const password = loginPassword.value
    
    if (!username || !password) {
        showAuthMessage('Please enter username and password')
        return
    }
    
    const fakeEmail = `${username}@anon.com`
    
    const { data, error } = await supabase.auth.signInWithPassword({
        email: fakeEmail,
        password: password
    })
    
    if (error) {
        showAuthMessage('Invalid username or password')
        return
    }
    
    if (data.user) {
        currentUser = data.user
        currentUsernameSpan.textContent = username
        showFeed()
        loadFeed()
    }
}

// Sign Out
async function signOut() {
    await supabase.auth.signOut()
    currentUser = null
    authSection.style.display = 'block'
    feedSection.style.display = 'none'
    loginUsername.value = ''
    loginPassword.value = ''
}

// Create a post
async function createPost() {
    const content = postContent.value.trim()
    if (!content) return
    
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
        alert('You must be logged in')
        return
    }
    
    const { error } = await supabase
        .from('posts')
        .insert([{ 
            user_id: user.id, 
            content: content 
        }])
    
    if (error) {
        console.error('Post error:', error)
        alert('Failed to post: ' + error.message)
    } else {
        postContent.value = ''
        updateCharCount()
        loadFeed()
    }
}
// Load feed
async function loadFeed() {
    try {
        // Get all posts
        const { data: posts, error: postsError } = await supabase
            .from('posts')
            .select('*')
            .order('created_at', { ascending: false })
            .limit(50)
        
        if (postsError) {
            console.error('Feed error:', postsError)
            feedDiv.innerHTML = '<div class="empty-feed">Error loading feed</div>'
            return
        }
        
        if (!posts || posts.length === 0) {
            feedDiv.innerHTML = '<div class="empty-feed">No posts yet. Be the first to speak!</div>'
            return
        }
        
        // Get all unique user IDs from posts
        const userIds = [...new Set(posts.map(p => p.user_id))]
        
        // Get profiles for those users
        const { data: profiles, error: profilesError } = await supabase
            .from('profiles')
            .select('id, username')
            .in('id', userIds)
        
        if (profilesError) {
            console.error('Profiles error:', profilesError)
        }
        
        // Create a map of user_id -> username
        const usernameMap = new Map()
        if (profiles) {
            profiles.forEach(p => usernameMap.set(p.id, p.username))
        }
        
        // Render posts
        feedDiv.innerHTML = posts.map(post => `
            <div class="post">
                <div class="post-header">
                    <span class="post-username">${escapeHtml(usernameMap.get(post.user_id) || 'Anonymous')}</span>
                    <span class="post-time">${formatTime(post.created_at)}</span>
                </div>
                <p class="post-content">${escapeHtml(post.content)}</p>
            </div>
        `).join('')
        
    } catch (err) {
        console.error('Unexpected error:', err)
        feedDiv.innerHTML = '<div class="empty-feed">Error loading feed</div>'
    }
}
// Update character counter
function updateCharCount() {
    const length = postContent.value.length
    charCount.textContent = `${length}/500`
    if (length > 450) {
        charCount.classList.add('warning')
    } else {
        charCount.classList.remove('warning')
    }
}

// Helper: Escape HTML
function escapeHtml(text) {
    const div = document.createElement('div')
    div.textContent = text
    return div.innerHTML
}

// Helper: Format time
function formatTime(timestamp) {
    const date = new Date(timestamp)
    const now = new Date()
    const diff = now - date
    const minutes = Math.floor(diff / 60000)
    const hours = Math.floor(diff / 3600000)
    const days = Math.floor(diff / 86400000)
    
    if (minutes < 1) return 'just now'
    if (minutes < 60) return `${minutes}m ago`
    if (hours < 24) return `${hours}h ago`
    if (days < 7) return `${days}d ago`
    return date.toLocaleDateString()
}

// Show feed, hide auth
function showFeed() {
    authSection.style.display = 'none'
    feedSection.style.display = 'block'
}

// Check existing session on load
async function checkSession() {
    const { data: { session } } = await supabase.auth.getSession()
    if (session) {
        // Get username from profiles
        const { data: profile } = await supabase
            .from('profiles')
            .select('username')
            .eq('id', session.user.id)
            .single()
        
        currentUser = session.user
        currentUsernameSpan.textContent = profile?.username || 'User'
        showFeed()
        loadFeed()
    }
}

// Event listeners
loginBtn.addEventListener('click', signIn)
showSignupBtn.addEventListener('click', () => {
    loginForm.style.display = 'none'
    signupForm.style.display = 'block'
})
backToLoginBtn.addEventListener('click', () => {
    signupForm.style.display = 'none'
    loginForm.style.display = 'block'
})
signupBtn.addEventListener('click', signUp)
logoutBtn.addEventListener('click', signOut)
postBtn.addEventListener('click', createPost)
postContent.addEventListener('input', updateCharCount)

// Allow Enter to submit post (Ctrl+Enter for newline)
postContent.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && !e.ctrlKey && !e.shiftKey) {
        e.preventDefault()
        createPost()
    }
})

// Allow Enter to submit login/signup
loginPassword.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') signIn()
})
signupPassword.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') signUp()
})

// Initialize
checkSession()