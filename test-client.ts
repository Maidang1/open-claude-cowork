import { ACPClient } from "./src/main/acp/Client";

async function main() {
    console.log("Starting Test Client with Qwen...");
    const client = new ACPClient((msg) => {
        console.log("CALLBACK:", msg);
    });

    try {
        // Use test-agent for verification
        await client.connect("npx", ["tsx", "test-agent/index.ts"]);
        
        // Allow some time for init
        await new Promise(resolve => setTimeout(resolve, 2000));

        console.log("Connected. Sending 'Hello'...");
        await client.sendMessage("Hello, are you there?");
        
        await new Promise(resolve => setTimeout(resolve, 3000));
        
        console.log("Sending 'list files' request...");
        await client.sendMessage("Please list the files in the current directory.");
        
        await new Promise(resolve => setTimeout(resolve, 5000));
        
        client.disconnect();
        console.log("Test Finished.");
    } catch (e) {
        console.error("Test Error:", e);
    }
}

main();
