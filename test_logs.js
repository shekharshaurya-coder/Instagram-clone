// Test logging functionality
const token =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiI2OTIxYzUxMTY0OGZjNWQ3MzdkOGJiMDkiLCJ1c2VybmFtZSI6ImF2YW5pIiwiaWF0IjoxNzY0MzE5OTM2LCJleHAiOjE3NjQ5MjQ3MzZ9.wv-7L_TZfzzd5jfhZMR-p1pJfDZfhZW7jUkL_0GSZPA";

async function testLogs() {
  console.log("🧪 Testing log generation...\n");

  // Test 1: Create a post (should generate POST_CREATED log)
  console.log("1️⃣ Testing POST_CREATED event...");
  try {
    const postRes = await fetch("http://localhost:3000/api/posts", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${token}`,
      },
      body: JSON.stringify({
        content: "Test post for logging verification",
        type: "text",
      }),
    });
    const postData = await postRes.json();
    console.log("✅ Post created:", postData.id, "\n");
  } catch (err) {
    console.error("❌ Error creating post:", err.message, "\n");
  }

  // Wait a bit for logs to be sent
  await new Promise(r => setTimeout(r, 2000));

  // Test 2: Query logs from Elasticsearch
  console.log("2️⃣ Querying logs from Elasticsearch...");
  try {
    const logsRes = await fetch("http://localhost:9200/socialsync-logs-*/_search", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        query: { match_all: {} },
        size: 10,
      }),
    });
    const logsData = await logsRes.json();
    const totalLogs = logsData.hits?.total?.value || 0;
    console.log(`✅ Found ${totalLogs} logs in Elasticsearch\n`);

    if (logsData.hits?.hits?.length > 0) {
      console.log("📋 Latest logs:");
      logsData.hits.hits.slice(0, 3).forEach((hit, i) => {
        const log = hit._source;
        console.log(`  ${i + 1}. [${log.eventType}] ${log.description} (${log.username})`);
      });
    } else {
      console.log("⚠️  No logs found yet. This may take a few seconds to process.");
    }
  } catch (err) {
    console.error("❌ Error querying Elasticsearch:", err.message);
  }

  console.log("\n✅ Test complete!");
}

testLogs().catch(console.error);
