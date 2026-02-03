"use client";

import { useState, useOptimistic, useTransition } from "react";
import type { ProductCategory } from "@prisma/client";
import type { ProductWithRelations, OptimisticAction } from "@/types/product";
import type {
  CreateProductInput,
  EditProductInput,
} from "@/lib/validations/product-schema";
import ProductTable from "@/components/products/product-table";
import ProductForm from "@/components/products/product-form";
import ProductDetailModal from "@/components/products/product-detail-modal";
import DeleteConfirmationModal from "@/components/products/delete-confirmation-modal";
import Modal from "@/components/ui/modal";
import {
  createProduct,
  updateProduct,
  softDeleteProduct,
  getProducts,
} from "@/app/actions/product-actions";

type FilterType = "all" | "active" | "inactive";

interface ProductManagementClientProps {
  initialProducts: ProductWithRelations[];
  categories: ProductCategory[];
}

export default function ProductManagementClient({
  initialProducts,
  categories,
}: ProductManagementClientProps) {
  const [products, setProducts] =
    useState<ProductWithRelations[]>(initialProducts);
  const [filter, setFilter] = useState<FilterType>("all");
  const [categoryFilter, setCategoryFilter] = useState<string>("");
  const [searchQuery, setSearchQuery] = useState<string>("");

  // Optimistic state
  const [optimisticProducts, addOptimisticUpdate] = useOptimistic(
    products,
    (state: ProductWithRelations[], action: OptimisticAction) => {
      switch (action.type) {
        case "create":
          // Add new product to the beginning (temp)
          return [action.product, ...state];
        case "update":
          // Update existing product
          return state.map((p) =>
            p.id === action.id ? { ...p, ...action.product } : p,
          );
        case "delete":
          // Remove product from list
          return state.filter((p) => p.id !== action.id);
        default:
          return state;
      }
    },
  );

  const [isPending, startTransition] = useTransition();

  // Modal states
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [detailModalOpen, setDetailModalOpen] = useState(false);
  const [editingProduct, setEditingProduct] =
    useState<ProductWithRelations | null>(null);
  const [viewingProduct, setViewingProduct] =
    useState<ProductWithRelations | null>(null);
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [deletingProduct, setDeletingProduct] =
    useState<ProductWithRelations | null>(null);

  // Error states - separate for page and modal
  const [pageError, setPageError] = useState("");
  const [modalError, setModalError] = useState("");

  // Refresh products list
  async function refreshProducts() {
    try {
      const fetchedProducts = await getProducts(
        filter,
        categoryFilter,
        searchQuery,
      );
      setProducts(fetchedProducts);
    } catch (err) {
      setPageError(
        err instanceof Error ? err.message : "Failed to fetch products",
      );
    }
  }

  // Filter handler
  async function handleFilterChange(newFilter: FilterType) {
    setFilter(newFilter);
    startTransition(async () => {
      try {
        const fetchedProducts = await getProducts(
          newFilter,
          categoryFilter,
          searchQuery,
        );
        setProducts(fetchedProducts);
      } catch (err) {
        setPageError(
          err instanceof Error ? err.message : "Failed to fetch products",
        );
      }
    });
  }

  // Category filter handler
  async function handleCategoryFilterChange(categoryId: string) {
    setCategoryFilter(categoryId);
    startTransition(async () => {
      try {
        const fetchedProducts = await getProducts(
          filter,
          categoryId || undefined,
          searchQuery,
        );
        setProducts(fetchedProducts);
      } catch (err) {
        setPageError(
          err instanceof Error ? err.message : "Failed to fetch products",
        );
      }
    });
  }

  // Search handler
  async function handleSearch(query: string) {
    setSearchQuery(query);
    startTransition(async () => {
      try {
        const fetchedProducts = await getProducts(
          filter,
          categoryFilter || undefined,
          query || undefined,
        );
        setProducts(fetchedProducts);
      } catch (err) {
        setPageError(
          err instanceof Error ? err.message : "Failed to fetch products",
        );
      }
    });
  }

  // Handle create with optimistic update
  async function handleCreateProduct(data: CreateProductInput) {
    const tempId = `temp-${Date.now()}`;
    setModalError(""); // Clear previous modal errors

    startTransition(async () => {
      // Optimistically add product to UI (inside transition)
      const optimisticProduct: ProductWithRelations = {
        id: tempId,
        name: data.name,
        description: data.description || null,
        categoryId: data.categoryId || null,
        category: data.categoryId
          ? categories.find((c) => c.id === data.categoryId) || null
          : null,
        active: true,
        createdAt: new Date(),
        updatedAt: new Date(),
        deletedAt: null,
        variants: data.variants.map((v, idx) => ({
          id: `temp-variant-${idx}`,
          productId: tempId,
          sku: v.sku,
          name: v.name || null,
          price: v.price,
          costPrice: v.costPrice,
          stock: {
            id: `temp-stock-${idx}`,
            productVariantId: `temp-variant-${idx}`,
            quantity: 0,
            updatedAt: new Date(),
          },
        })),
      };

      addOptimisticUpdate({
        type: "create",
        tempId,
        product: optimisticProduct,
      });

      try {
        await createProduct(data);
        setCreateModalOpen(false);
        setModalError(""); // Clear on success
        await refreshProducts();
      } catch (err) {
        setModalError(
          err instanceof Error ? err.message : "Failed to create product",
        );
        // Optimistic update will be rolled back automatically
      }
    });
  }

  // Handle update with optimistic update
  async function handleUpdateProduct(
    id: string,
    data: Partial<EditProductInput>,
  ) {
    const currentProduct = products.find((p) => p.id === id);
    if (!currentProduct) return;

    setModalError(""); // Clear previous modal errors

    startTransition(async () => {
      // Optimistically update product in UI (inside transition)
      const optimisticUpdate: Partial<ProductWithRelations> = {
        name: data.name,
        description: data.description,
        categoryId: data.categoryId,
        active: data.active,
        category: data.categoryId
          ? categories.find((c) => c.id === data.categoryId) ||
            currentProduct.category
          : currentProduct.category,
      };

      addOptimisticUpdate({ type: "update", id, product: optimisticUpdate });

      try {
        await updateProduct(id, data);
        setEditModalOpen(false);
        setEditingProduct(null);
        setModalError(""); // Clear on success
        await refreshProducts();
      } catch (err) {
        setModalError(
          err instanceof Error ? err.message : "Failed to update product",
        );
        // Optimistic update will be rolled back automatically
      }
    });
  }

  // Handle delete with optimistic update
  async function handleDeleteConfirm() {
    if (!deletingProduct) return;

    startTransition(async () => {
      // Optimistically remove product from UI (inside transition)
      addOptimisticUpdate({ type: "delete", id: deletingProduct.id });

      try {
        await softDeleteProduct(deletingProduct.id);
        setDeleteModalOpen(false);
        setDeletingProduct(null);
        await refreshProducts();
      } catch (err) {
        setPageError(
          err instanceof Error ? err.message : "Failed to delete product",
        );
        // Optimistic update will be rolled back automatically
      }
    });
  }

  // View product details
  function handleViewProduct(product: ProductWithRelations) {
    setViewingProduct(product);
    setDetailModalOpen(true);
  }

  // Edit product
  function handleEditProduct(product: ProductWithRelations) {
    setEditingProduct(product);
    setEditModalOpen(true);
  }

  // Delete product
  function handleDeleteClick(product: ProductWithRelations) {
    setDeletingProduct(product);
    setDeleteModalOpen(true);
  }

  // Filter products for display
  const filteredProducts = optimisticProducts.filter((product) => {
    if (filter === "active") {
      return product.active;
    } else if (filter === "inactive") {
      return !product.active;
    }
    return true;
  });

  return (
    <div className="mt-8">
      {/* Page-level error display */}
      {pageError && (
        <div className="mb-4 bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded">
          {pageError}
          <button
            onClick={() => setPageError("")}
            className="ml-2 font-medium underline"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* Filters and search */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6">
        <div className="flex flex-wrap gap-2">
          {/* Status filter tabs */}
          <button
            onClick={() => handleFilterChange("all")}
            className={`px-4 py-2 text-sm font-medium rounded-md transition-colors ${
              filter === "all"
                ? "bg-indigo-600 text-white"
                : "bg-white text-gray-700 border border-gray-300 hover:bg-gray-50"
            }`}
          >
            All
          </button>
          <button
            onClick={() => handleFilterChange("active")}
            className={`px-4 py-2 text-sm font-medium rounded-md transition-colors ${
              filter === "active"
                ? "bg-indigo-600 text-white"
                : "bg-white text-gray-700 border border-gray-300 hover:bg-gray-50"
            }`}
          >
            Active
          </button>
          <button
            onClick={() => handleFilterChange("inactive")}
            className={`px-4 py-2 text-sm font-medium rounded-md transition-colors ${
              filter === "inactive"
                ? "bg-indigo-600 text-white"
                : "bg-white text-gray-700 border border-gray-300 hover:bg-gray-50"
            }`}
          >
            Inactive
          </button>

          {/* Category filter */}
          <select
            value={categoryFilter}
            onChange={(e) => handleCategoryFilterChange(e.target.value)}
            className="px-4 py-2 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
          >
            <option value="">All Categories</option>
            {categories.map((cat) => (
              <option key={cat.id} value={cat.id}>
                {cat.name}
              </option>
            ))}
          </select>
        </div>

        <div className="flex gap-2 w-full sm:w-auto">
          {/* Search */}
          <input
            type="text"
            placeholder="Search products or SKU..."
            value={searchQuery}
            onChange={(e) => handleSearch(e.target.value)}
            className="px-4 py-2 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 flex-1 sm:w-64"
          />

          {/* New product button */}
          <button
            onClick={() => setCreateModalOpen(true)}
            className="px-4 py-2 bg-indigo-600 text-white rounded-md text-sm font-medium hover:bg-indigo-700 flex items-center gap-2 whitespace-nowrap"
          >
            <svg
              className="h-5 w-5"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M12 4v16m8-8H4"
              />
            </svg>
            New Product
          </button>
        </div>
      </div>

      {/* Products table */}
      {isPending && products.length === 0 ? (
        <div className="text-center py-12 bg-white rounded-lg shadow">
          <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div>
          <p className="mt-2 text-sm text-gray-500">Loading products...</p>
        </div>
      ) : (
        <ProductTable
          products={filteredProducts}
          onView={handleViewProduct}
          onEdit={handleEditProduct}
          onDelete={handleDeleteClick}
          isPending={isPending}
        />
      )}

      {createModalOpen && (
        <Modal
          isOpen={createModalOpen}
          onClose={() => {
            setCreateModalOpen(false);
            setModalError("");
          }}
          title="Create New Product"
          size="lg"
        >
          <ProductForm
            mode="create"
            categories={categories}
            onSubmit={handleCreateProduct}
            onCancel={() => {
              setCreateModalOpen(false);
              setModalError("");
            }}
            isPending={isPending}
            error={modalError}
          />
        </Modal>
      )}

      {/* Edit product modal */}
      {editModalOpen && editingProduct && (
        <Modal
          isOpen={editModalOpen}
          onClose={() => {
            setEditModalOpen(false);
            setEditingProduct(null);
            setModalError(""); // Clear error on close
          }}
          title="Edit Product"
          size="lg"
        >
          <ProductForm
            mode="edit"
            product={editingProduct}
            categories={categories}
            onSubmit={(data) => handleUpdateProduct(editingProduct.id, data)}
            onCancel={() => {
              setEditModalOpen(false);
              setEditingProduct(null);
              setModalError(""); // Clear error on cancel
            }}
            isPending={isPending}
            error={modalError}
          />
        </Modal>
      )}

      {/* View product detail modal */}
      {detailModalOpen && viewingProduct && (
        <ProductDetailModal
          isOpen={detailModalOpen}
          onClose={() => {
            setDetailModalOpen(false);
            setViewingProduct(null);
          }}
          product={viewingProduct}
          onEdit={() => {
            setDetailModalOpen(false);
            handleEditProduct(viewingProduct);
          }}
        />
      )}

      {/* Delete confirmation modal */}
      {deletingProduct && (
        <DeleteConfirmationModal
          isOpen={deleteModalOpen}
          onClose={() => {
            setDeleteModalOpen(false);
            setDeletingProduct(null);
          }}
          onConfirm={handleDeleteConfirm}
          productName={deletingProduct.name}
          variantCount={deletingProduct.variants.length}
          isPending={isPending}
        />
      )}
    </div>
  );
}
