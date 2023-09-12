const mongoose = require("mongoose");
const Schema = mongoose.Schema;

const orderSchema = new Schema(
  {
    customerId: {
      type: Number,
      required: true,
    },
    shippingAddress: {
      type: String,
      required: true,
    },
    products: [
      {
        productId: {
          type: Number,
          required: true,
        },
        quantity: {
          type: Number,
          required: true,
        },
      },
    ],
    orderDate: {
      type: Date,
      default: Date.now,
    },
    orderStatus: {
      type: String,
      enum: ["Pending", "Shipped", "Delivered"],
      default: "Pending",
    },
    totalAmount: {
      type: Number,
      required: true,
    },
  },
  { timestamps: false }
);

module.exports = mongoose.model("Order", orderSchema);
