const express = require("express");
const {
  getAllOrders,
  getOrder,
  createOrder,
  updateOrder,
  updateOrderStatus,
  cancelOrder,
  deleteOrder,
  hasCurrentOrders,
  isProductUsed,
} = require("../controllers/orderController");

const router = express.Router();

router.get("/get/all", getAllOrders);
router.get("/get/:_id", getOrder);
router.get("/check/user/:userId", hasCurrentOrders);
router.get("/check/product/:productId", isProductUsed);
router.post("/create", createOrder);
router.patch("/update", updateOrder);
router.patch("/update/status", updateOrderStatus);
router.delete("/cancel", cancelOrder);
router.delete("/delete", deleteOrder);

module.exports = router;
