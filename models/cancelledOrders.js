const mongoose = require("mongoose");
const Schema = mongoose.Schema;

const cancelledOrderSchema = new Schema(
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
    totalAmount: {
      type: Number,
      required: true,
    },
  },
  { timestamps: false }
);

module.exports = mongoose.model("cancelled_Orders", cancelledOrderSchema);
