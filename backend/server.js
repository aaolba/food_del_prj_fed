import express from "express";
import cors from "cors";
import { connectDB } from "./config/db.js";
import foodRouter from "./routes/foodRoute.js";
import userRouter from "./routes/userRoute.js";
import "dotenv/config";
import cartRouter from "./routes/cartRoute.js";
import orderRouter from "./routes/orderRoute.js";

// app config
const app = express();
const port = process.env.PORT || 4000;

// middlewares
app.use(express.json());
app.use(cors());

// DB connection
connectDB();

// Health check endpoint
app.get("/health", (req, res) => {
  res.status(200).json({ 
    status: "UP", 
    timestamp: new Date().toISOString(),
    uptime: process.uptime()
  });
});

// Metrics endpoint for Prometheus
app.get("/metrics", (req, res) => {
  const memUsage = process.memoryUsage();
  const metrics = `# HELP nodejs_heap_size_total_bytes Total heap size in bytes
# TYPE nodejs_heap_size_total_bytes gauge
nodejs_heap_size_total_bytes ${memUsage.heapTotal}

# HELP nodejs_heap_size_used_bytes Used heap size in bytes
# TYPE nodejs_heap_size_used_bytes gauge
nodejs_heap_size_used_bytes ${memUsage.heapUsed}

# HELP nodejs_external_memory_bytes External memory in bytes
# TYPE nodejs_external_memory_bytes gauge
nodejs_external_memory_bytes ${memUsage.external}

# HELP process_uptime_seconds Process uptime in seconds
# TYPE process_uptime_seconds counter
process_uptime_seconds ${process.uptime()}

# HELP process_cpu_user_seconds_total Total user CPU time
# TYPE process_cpu_user_seconds_total counter
process_cpu_user_seconds_total ${process.cpuUsage().user / 1000000}

# HELP process_cpu_system_seconds_total Total system CPU time
# TYPE process_cpu_system_seconds_total counter
process_cpu_system_seconds_total ${process.cpuUsage().system / 1000000}
`;
  
  res.set("Content-Type", "text/plain");
  res.send(metrics);
});

// api endpoints
app.use("/api/food", foodRouter);
app.use("/images", express.static("uploads"));
app.use("/api/user", userRouter);
app.use("/api/cart", cartRouter);
app.use("/api/order", orderRouter);

app.get("/", (req, res) => {
  res.send("API Working");
});

app.listen(port, () => {
  console.log(`Server Started on port: ${port}`);
});
