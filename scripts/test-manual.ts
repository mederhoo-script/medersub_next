
// This is a manual verification script you can use to test the API wrapper logic
import { inlomax } from './lib/inlomax';

async function test() {
    console.log("Testing Inlomax API Wrapper...");
    try {
        const balance = await inlomax.getBalance();
        console.log("Balance:", balance);

        // Add more tests if you wish to run `npx ts-node scripts/test-manual.ts`
        // But requires env vars to be loaded.
    } catch (e) {
        console.error(e);
    }
}
// test();
