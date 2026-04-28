const axios = require("axios");
const loginData = { email: "admin@pricewise.com", password: "Admin@123" };
const baseUrl = "http://localhost:5000/api";

async function run() {
  try {
    console.log("Logging in...");
    const loginRes = await axios.post(`${baseUrl}/auth/login`, loginData);
    const token = loginRes.data.accessToken || loginRes.data.token || loginRes.data.data?.token || loginRes.data.data?.accessToken;
    if (!token) {
      console.log("No token found.");
      return;
    }
    const config = { headers: { Authorization: `Bearer ${token}` } };

    const endpoints = [
      `${baseUrl}/invoices/admin/all?limit=5`,
      `${baseUrl}/invoices/admin/all?status=REVIEW&limit=5`
    ];

    for (const url of endpoints) {
      console.log(`\nCalling: ${url}`);
      try {
        const res = await axios.get(url, config);
        const data = res.data;
        const invoices = data.invoices || data.data || (Array.isArray(data) ? data : []);
        console.log(`Count: ${invoices.length}`);
        if (invoices.length > 0) {
          console.log(`First Invoice -> ID: ${invoices[0]._id || invoices[0].id}, Status: ${invoices[0].status}`);
        } else {
          console.log("No invoices found.");
        }
      } catch (err) {
        console.log(`Error Status: ${err.response?.status}`);
        console.log(`Error Body: ${JSON.stringify(err.response?.data)}`);
      }
    }
  } catch (err) {
    console.log(`Login Error: ${err.message}`);
    if (err.response) console.log(`Login Error Body: ${JSON.stringify(err.response.data)}`);
  }
}
run();
