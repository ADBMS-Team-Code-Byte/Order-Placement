require("dotenv").config();
const mongoose = require("mongoose");
const express = require("express");
const app = express();
app.use(express.json());


//routers
const orderRouter = require("./routes/order");
app.use("/orders", orderRouter);


mongoose
  .connect(process.env.MONGO_URI)
  .then(() => {
    app.listen(process.env.PORT, () => {
      console.log("server started on ", process.env.PORT);
    });
  })
  .catch((error) => {
    console.log(error);
  });
