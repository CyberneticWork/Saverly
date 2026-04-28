const axios = require("axios");
const loginData = { email: "admin@pricewise.com", password: "Admin@123" };

async function checkHost(host) {
  console.log(`\nChecking host: ${host}`);
  try {
    const loginUrl = `${host}/auth/login`;
    const loginRes = await axios.post(loginUrl, loginData);
    console.log("Login: Success, Response Body Keys:", Object.keys(loginRes.data));
    const token = loginRes.data.accessToken || loginRes.data.token || loginRes.data.data?.token || loginRes.data.data?.accessToken;
    if (!token) {
        console.log("No token found in response body.");
        return;
    }
    const config = { headers: { Authorization: `Bearer ${token}` } };
    
    // Check all invoices
    try {
      const resAll = await axios.get(`${host}/invoices/admin/all`, config);
      const invoicesAll = resAll.data.invoices || resAll.data.data || (Array.isArray(resAll.data) ? resAll.data : []);
      console.log(`/invoices/admin/all: Success, Count: ${invoicesAll.length}`);
    } catch (err) {
      console.log(`/invoices/admin/all: Failed, Status: ${err.response?.status}, Body: ${JSON.stringify(err.response?.data)}`);
    }

    // Check REVIEW invoices
    try {
      const resReview = await axios.get(`${host}/invoices/admin/all?status=REVIEW`, config);
      const invoicesReview = resReview.data.invoices || resReview.data.data || (Array.isArray(resReview.data) ? resReview.data : []);
      console.log(`/invoices/admin/all?status=REVIEW: Success, Count: ${invoicesReview.length}`);
    } catch (err) {
      console.log(`/invoices/admin/all?status=REVIEW: Failed, Status: ${err.response?.status}, Body: ${JSON.stringify(err.response?.data)}`);
    }
    
  } catch (err) {
    if (err.response) {
      console.log(`Login: Failed, Status: ${err.response.status}, Body: ${JSON.stringify(err.response.data)}`);
    } else {
      console.log(`Login: Failed, Message: ${err.message}`);
    }
  }
}

async function run() {
  await checkHost("http://localhost:5000/api");
  await checkHost("http://10.131.208.6:5000/api");
}
run();
