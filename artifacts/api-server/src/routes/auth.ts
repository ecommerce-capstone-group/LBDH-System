import { Router, type IRouter } from "express";
import { authenticateEmployee } from "../lib/employee-accounts";

const router: IRouter = Router();

router.post("/auth/login", async (req, res) => {
  try {
    const username =
      typeof req.body?.username === "string" ? req.body.username.trim() : "";
    const password =
      typeof req.body?.password === "string" ? req.body.password : "";

    if (!username || !password) {
      return res.status(400).json({ error: "Username and password are required" });
    }

    // HR and Unit Head stay on the client demo login — this endpoint is for
    // employee accounts linked to employee profiles only.
    const session = await authenticateEmployee(username, password);
    if (!session) {
      return res.status(401).json({ error: "Invalid username or password" });
    }

    res.json(session);
  } catch (err) {
    console.error("employee login failed", err);
    res.status(500).json({ error: "Could not sign in" });
  }
});

export default router;
