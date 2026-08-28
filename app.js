// 정확한 Google Web App URL
const API_URL = "https://script.google.com/macros/s/AKfycbyIEMm30vUurbfTsMSRThMNmqSM_ErntbNqY221QUnJzXx9kmbMKacQb6MbufSjI5-oYg/exec";

let loggedInUser = null;
let crmData = { leads: [], users: [] };

// Smart Request Handler (Fetch + JSONP Fallback)
async function makeRequest(params) {
  const query = new URLSearchParams(params).toString();
  const url = `${API_URL}?${query}`;
  
  try {
    const res = await fetch(url, { method: 'GET', mode: 'cors' });
    return await res.json();
  } catch (err) {
    // Fallback to JSONP
    return new Promise((resolve, reject) => {
      const cbName = 'crm_cb_' + Math.floor(Math.random() * 1000000);
      window[cbName] = function(data) {
        delete window[cbName];
        if (script.parentNode) script.parentNode.removeChild(script);
        resolve(data);
      };
      const script = document.createElement('script');
      script.src = `${url}&callback=${cbName}`;
      script.onerror = function() {
        delete window[cbName];
        if (script.parentNode) script.parentNode.removeChild(script);
        reject(new Error('Network error'));
      };
      document.body.appendChild(script);
    });
  }
}

async function login() {
  const u = document.getElementById('logUser').value.trim();
  const p = document.getElementById('logPass').value.trim();
  const msg = document.getElementById('logMsg');
  const btn = document.getElementById('loginBtn');

  msg.innerText = "Signing in...";
  btn.disabled = true;

  try {
    const result = await makeRequest({ action: 'login', username: u, password: p });

    if (result && result.success) {
      loggedInUser = result.user;
      document.getElementById('loginScreen').classList.add('hidden');
      document.getElementById('userNameBadge').innerText = loggedInUser.fullName;
      document.getElementById('profName').innerText = loggedInUser.fullName;
      document.getElementById('profUser').innerText = loggedInUser.username;
      document.getElementById('profRole').innerText = loggedInUser.role;
      refreshData();
    } else {
      msg.innerText = (result && result.message) ? result.message : "Invalid Username or Password!";
    }
  } catch (err) {
    msg.innerText = "Connection Error! Check script or network.";
  } finally {
    btn.disabled = false;
  }
}

function switchTab(evt, tabId) {
  document.querySelectorAll('.tab-pane').forEach(el => el.classList.add('hidden'));
  document.querySelectorAll('.nav-item').forEach(el => el.classList.remove('active'));
  document.getElementById(tabId).classList.remove('hidden');
  if (evt && evt.currentTarget) evt.currentTarget.classList.add('active');
  const titles = {
    'tab-dashboard': 'Dashboard',
    'tab-add-lead': 'Add New Lead',
    'tab-lead-sheet': 'Lead Sheet & Status',
    'tab-users': 'Team Management',
    'tab-reports': 'Performance Reports',
    'tab-profile': 'User Profile'
  };
  document.getElementById('pageTitle').innerText = titles[tabId] || 'FM CRM';
}

async function refreshData() {
  try {
    crmData = await makeRequest({ action: 'getData' });
    renderAll();
  } catch (err) {
    console.error("Data load error:", err);
  }
}

function renderAll() {
  const leads = crmData.leads || [];
  const users = crmData.users || [];

  const todayStr = new Date().toISOString().slice(0, 10);
  const total = leads.length;
  const todayCount = leads.filter(l => String(l.timestamp).includes(todayStr)).length;
  const newCount = leads.filter(l => l.status === 'New').length;
  const bookedCount = leads.filter(l => l.status === 'Booked' || l.status === 'Won').length;

  document.getElementById('valTotal').innerText = total;
  document.getElementById('valToday').innerText = todayCount;
  document.getElementById('valNew').innerText = newCount;
  document.getElementById('valBooked').innerText = bookedCount;

  // Summary
  const summary = {};
  users.forEach(u => { summary[u.username] = { name: u.fullName, assigned: 0, booked: 0 }; });
  leads.forEach(l => {
    if (!summary[l.assignedTo]) summary[l.assignedTo] = { name: l.assignedTo, assigned: 0, booked: 0 };
    summary[l.assignedTo].assigned++;
    if (l.status === 'Booked' || l.status === 'Won') summary[l.assignedTo].booked++;
  });

  const sBody = document.getElementById('teamSummaryBody');
  sBody.innerHTML = '';
  for (const uKey in summary) {
    sBody.innerHTML += `<tr>
      <td><b>${summary[uKey].name}</b> (${uKey})</td>
      <td>${summary[uKey].assigned}</td>
      <td>${summary[uKey].booked}</td>
    </tr>`;
  }

  // Assign dropdown options
  const aSel = document.getElementById('fAssign');
  aSel.innerHTML = '';
  users.forEach(u => {
    aSel.innerHTML += `<option value="${u.username}">${u.fullName} (${u.role})</option>`;
  });

  // All Leads Table with editable status
  const lBody = document.getElementById('allLeadsBody');
  lBody.innerHTML = '';
  leads.forEach(l => {
    let userOptions = users.map(u => `<option value="${u.username}" ${u.username === l.assignedTo ? 'selected' : ''}>${u.fullName}</option>`).join('');
    
    let statusOptions = ['New', 'Contacted', 'In Progress', 'Booked', 'Lost', 'Cancelled'].map(st => 
      `<option value="${st}" ${st === l.status ? 'selected' : ''}>${st}</option>`
    ).join('');

    lBody.innerHTML += `<tr>
      <td><b>${l.id}</b></td>
      <td>${l.timestamp}</td>
      <td>${l.customer}</td>
      <td>${l.phone}</td>
      <td>${l.city}</td>
      <td>${l.service}</td>
      <td><select id="sel_assign_${l.id}" class="table-select">${userOptions}</select></td>
      <td><select id="sel_status_${l.id}" class="table-select">${statusOptions}</select></td>
      <td><button class="btn-save-sm" onclick="saveLeadStatus('${l.id}')"><i class="fa-solid fa-floppy-disk"></i> Save</button></td>
    </tr>`;
  });

  // Users List Table
  const uBody = document.getElementById('usersListBody');
  uBody.innerHTML = '';
  users.forEach(u => {
    uBody.innerHTML += `<tr><td>${u.fullName}</td><td>${u.username}</td><td><span class="badge badge-booked">${u.role}</span></td></tr>`;
  });
}

// Add New Lead
async function saveLead() {
  const btn = document.getElementById('submitBtn');
  const cust = document.getElementById('fName').value.trim();
  const phone = document.getElementById('fPhone').value.trim();
  const city = document.getElementById('fCity').value.trim();
  const service = document.getElementById('fService').value.trim();
  const assignedTo = document.getElementById('fAssign').value;
  const notes = document.getElementById('fNotes').value.trim();

  if (!cust || !phone) {
    alert("Please enter Name and Phone!");
    return;
  }

  btn.disabled = true;
  btn.innerText = "Submitting...";

  try {
    await makeRequest({
      action: 'addLead',
      customer: cust,
      phone: phone,
      city: city,
      service: service,
      assignedTo: assignedTo,
      notes: notes
    });
    
    alert("Lead submitted successfully!");
    document.getElementById('fName').value = '';
    document.getElementById('fPhone').value = '';
    document.getElementById('fCity').value = '';
    document.getElementById('fService').value = '';
    document.getElementById('fNotes').value = '';
    refreshData();
    switchTab(null, 'tab-dashboard');
  } catch (err) {
    alert("Error submitting lead!");
  } finally {
    btn.disabled = false;
    btn.innerText = "Submit Lead";
  }
}

// Add New User / Team Member
async function saveUser() {
  const btn = document.getElementById('btnCreateUser');
  const fullName = document.getElementById('uFullName').value.trim();
  const username = document.getElementById('uEmail').value.trim();
  const password = document.getElementById('uPass').value.trim();
  const role = document.getElementById('uRole').value;

  if (!fullName || !username || !password) {
    alert("Please fill in Name, Email and Password!");
    return;
  }

  btn.disabled = true;
  btn.innerText = "Creating...";

  try {
    await makeRequest({
      action: 'addUser',
      fullName: fullName,
      username: username,
      password: password,
      role: role
    });
    alert("User created successfully!");
    document.getElementById('uFullName').value = '';
    document.getElementById('uEmail').value = '';
    document.getElementById('uPass').value = '';
    refreshData();
  } catch (err) {
    alert("Error creating user!");
  } finally {
    btn.disabled = false;
    btn.innerText = "Create Member";
  }
}

// Save Lead Status Changes
async function saveLeadStatus(leadId) {
  const status = document.getElementById(`sel_status_${leadId}`).value;
  const assignedTo = document.getElementById(`sel_assign_${leadId}`).value;

  try {
    await makeRequest({
      action: 'updateLeadStatus',
      leadId: leadId,
      status: status,
      assignedTo: assignedTo
    });
    alert(`Lead ${leadId} updated successfully!`);
    refreshData();
  } catch (err) {
    alert("Error updating status!");
  }
}

function logout() {
  loggedInUser = null;
  document.getElementById('loginScreen').classList.remove('hidden');
}
