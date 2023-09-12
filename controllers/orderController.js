const orderModel = require("../models/order");
const cancelledOrdersModel = require("../models/cancelledOrders");
const mongoose = require("mongoose");
require("dotenv").config();

// Get all orders
const getAllOrders = async (req, res) => {
  try {
    const listOfOrders = await orderModel.find({});
    res.json(listOfOrders);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// Get a single order
const getOrder = async (req, res) => {
  try {
    const { _id } = req.params;
    if (!_id) return res.status(404).json({ error: "Missing Order Id" });

    if (!mongoose.isValidObjectId(_id)) {
      return res
        .status(400)
        .json({ error: "Order not found or invalid Order Id" });
    }

    const order = await orderModel.findById(_id);

    if (!order) return res.status(404).json({ error: "Order not found" });

    res
      .status(200)
      .json({ message: "Order Info Retrieved successfully", order });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
};

// Create a new order
const createOrder = async (req, res) => {
  const { customerId, shippingAddress, products } = req.body;
  try {
    if (!customerId || !shippingAddress || !products)
      return res.status(400).json({ error: "Missing Credentials" });

    const orderProducts = products.map(({ productId, quantity }) => ({
      productId,
      quantity,
    }));

    const checkUserCall = await fetch(
      `${process.env.USER_API}/get/${customerId}`,
      {
        method: "GET",
        headers: {
          "Content-Type": "application/json",
        },
      }
    );

    console.log("calling Users API");
    const isUserValid = await checkUserCall.json();

    if (checkUserCall.status === 404) {
      return res
        .status(checkUserCall.status)
        .json({ error: "Customer not found" });
    }

    if (checkUserCall.status !== 200) {
      return res
        .status(checkUserCall.status)
        .json({ error: isUserValid.error });
    }

    const useProductsCall = await fetch(
      `${process.env.INVENTORY_API}/use/multiple`,
      {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(orderProducts),
      }
    );

    console.log("calling Inventory API");
    const useProductsData = await useProductsCall.json();

    if (useProductsCall.status !== 200) {
      return res
        .status(useProductsCall.status)
        .json({ error: useProductsData.error });
    }

    // Create the order
    const newOrder = new orderModel({
      customerId,
      shippingAddress,
      products,
      totalAmount: useProductsData.totalUsedPrice,
    });

    // Save the order
    await newOrder.save();

    return res
      .status(201)
      .json({ message: "Order created successfully", order: newOrder });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
};

// Update order
const updateOrder = async (req, res) => {
  const { _id, customerId, shippingAddress, products } = req.body;

  try {
    if (!_id) return res.status(404).json({ error: "Missing Order Id" });

    if (!mongoose.isValidObjectId(_id)) {
      return res
        .status(400)
        .json({ error: "Order not found or invalid Order Id" });
    }

    const existingOrder = await orderModel.findById(_id);
    if (!existingOrder)
      return res.status(404).json({ error: "Order not found" });

    if (existingOrder.orderStatus !== "Pending") {
      return res
        .status(400)
        .json({ error: "Failed! Order already shipped or delivered" });
    }

    const updatedFields = {};

    if (customerId) {
      const checkUserCall = await fetch(
        `${process.env.USER_API}/get/${customerId}`,
        {
          method: "GET",
          headers: {
            "Content-Type": "application/json",
          },
        }
      );

      console.log("calling Users API");
      const isUserValid = await checkUserCall.json();

      if (checkUserCall.status === 404) {
        return res
          .status(checkUserCall.status)
          .json({ error: "Customer not found" });
      }

      if (checkUserCall.status !== 200) {
        return res
          .status(checkUserCall.status)
          .json({ error: isUserValid.error });
      }
      updatedFields.customerId = customerId;
    }

    if (products) {
      let totalAmount;
      const existingProducts = existingOrder.products;

      const restockProductsCall = await fetch(
        `${process.env.INVENTORY_API}/restock/multiple`,
        {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify(existingProducts),
        }
      );

      console.log("restocking previous products");
      const restockProductsData = await restockProductsCall.json();

      if (restockProductsCall.status !== 200) {
        return res
          .status(restockProductsCall.status)
          .json({ error: restockProductsData.error });
      }

      const useProductsCall = await fetch(
        `${process.env.INVENTORY_API}/use/multiple`,
        {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify(products),
        }
      );

      console.log("calling Inventory API");
      const useProductsData = await useProductsCall.json();

      if (useProductsCall.status !== 200) {
        const revertRestockCall = await fetch(
          `${process.env.INVENTORY_API}/use/multiple`,
          {
            method: "PATCH",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify(existingProducts),
          }
        );

        console.log("reverting restock changes");
        const revertProductsData = await revertRestockCall.json();
        return res
          .status(useProductsCall.status)
          .json({ error: useProductsData.error });
      }
      totalAmount = useProductsData.totalUsedPrice;
      updatedFields.products = products;
      updatedFields.totalAmount = totalAmount;
    }

    if (shippingAddress) updatedFields.shippingAddress = shippingAddress;

    const updatedOrder = await orderModel.findOneAndUpdate(
      { _id },
      { $set: updatedFields },
      { new: true }
    );

    return res
      .status(200)
      .json({ message: "Order updated successfully", order: updatedOrder });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
};

// update order status
const updateOrderStatus = async (req, res) => {
  const { _id, orderStatus } = req.body;
  try {
    if (!_id) return res.status(404).json({ error: "Missing Order Id" });

    if (!mongoose.isValidObjectId(_id)) {
      return res
        .status(400)
        .json({ error: "Order not found or invalid Order Id" });
    }

    const existingOrder = await orderModel.findById(_id);

    if (!existingOrder)
      return res.status(404).json({ error: "Order not found" });

    // Check if the new order status is valid
    const validOrderStatuses = ["pending", "shipped", "delivered"];
    if (!validOrderStatuses.includes(orderStatus.toLowerCase())) {
      return res.status(400).json({ error: "Invalid order status" });
    }

    // Save the updated order
    existingOrder.orderStatus = orderStatus;
    await existingOrder.save();

    return res
      .status(200)
      .json({
        message: "Order status updated successfully",
        order: existingOrder,
      });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
};

//cancel order
const cancelOrder = async (req, res) => {
  const { _id } = req.body;

  try {
    if (!_id) return res.status(404).json({ error: "Missing Order Id" });

    if (!mongoose.isValidObjectId(_id)) {
      return res
        .status(400)
        .json({ error: "Order not found or invalid Order Id" });
    }

    const existingOrder = await orderModel.findById(_id);

    if (!existingOrder)
      return res.status(404).json({ error: "Order not found" });

    if (existingOrder.orderStatus !== "Pending") {
      return res
        .status(400)
        .json({ error: "Failed! Order has already been shipped or delivered" });
    }

    // Restock the relevant products
    const restockProductsCall = await fetch(
      `${process.env.INVENTORY_API}/restock/multiple`,
      {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(existingOrder.products),
      }
    );

    console.log("Restocking products for cancelled order");
    const restockProductsData = await restockProductsCall.json();

    if (restockProductsCall.status !== 200) {
      return res
        .status(restockProductsCall.status)
        .json({ error: restockProductsData.error });
    }

    //  new document in the CancelledOrders collection
    const cancelledOrder = new cancelledOrdersModel(existingOrder.toObject());
    await cancelledOrder.save();

    // Remove the order from the orders collection
    await orderModel.findByIdAndRemove(_id);

    return res.status(200).json({ message: "Order cancelled successfully" });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// Delete order
const deleteOrder = async (req, res) => {
  const { _id } = req.body;
  try {
    if (!_id) return res.status(404).json({ error: "Missing Order Id" });

    if (!mongoose.isValidObjectId(_id)) {
      return res
        .status(400)
        .json({ error: "Order not found or invalid Order Id" });
    }

    const order = await orderModel.findByIdAndRemove(_id);

    if (!order) return res.status(404).json({ error: "Order not found" });

    return res.status(200).json({ message: "Order deleted successfully" });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// check if  user has pending or shipped orders
const hasCurrentOrders = async (req, res) => {
  const { userId } = req.params;

  try {
    if (!userId) return res.status(404).json({ error: "User Id is required" });

    // Find orders with the status "Pending" or "Shipped" for the user
    const orders = await orderModel.find({
      customerId: userId,
      orderStatus: { $in: ["Pending", "Shipped"] },
    });

    if (orders.length > 0) {
      // Extract order IDs from the found orders
      const orderIds = orders.map((order) => order._id);

      return res.status(200).json({ hasCurrentOrders: true, orderIds });
    } else {
      return res.status(200).json({ hasCurrentOrders: false });
    }
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// check if the product is being used in any pending orders
const isProductUsed = async (req, res) => {
  const { productId } = req.params;

  try {
    if (!productId)
      return res.status(404).json({ error: "Product Id is required" });

    // Find orders with the status "Pending" that contain the  productId
    const orders = await orderModel.find({
      "products.productId": productId,
      orderStatus: "Pending",
    });

    if (orders.length > 0) {
      const orderIds = orders.map((order) => order._id);

      return res.status(200).json({ hasCurrentOrders: true, orderIds });
    } else {
      return res.status(200).json({ hasCurrentOrders: false });
    }
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

module.exports = {
  getAllOrders,
  getOrder,
  createOrder,
  updateOrder,
  updateOrderStatus,
  cancelOrder,
  deleteOrder,
  hasCurrentOrders,
  isProductUsed,
};
