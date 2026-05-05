"use client";

import {
  createCategory,
  createProduct,
  getProducts,
  softDeleteProduct,
  updateProduct,
} from "@/app/actions/product-actions";
import CategorySidebar from "@/components/products/category-sidebar";
import DeleteConfirmationModal from "@/components/products/delete-confirmation-modal";
import ImportCSVSidebar from "@/components/products/import-csv-sidebar";
import ProductDetailModal from "@/components/products/product-detail-modal";
import ProductForm from "@/components/products/product-form";
import ProductTable from "@/components/products/product-table";
import Sidebar from "@/components/ui/sidebar";
import type {
  CreateCategoryInput,
  CreateProductInput,
  EditProductInput,
} from "@/lib/validations/product-schema";
import type {
  OptimisticAction,
  PaginationInfo,
  ProductWithRelations,
} from "@/types/product";
import type { ProductCategory } from "@prisma/client";
import { useOptimistic, useState, useTransition } from "react";

type FilterType = "all" | "active" | "inactive";

interface ProductManagementClientProps {
  initialProducts: ProductWithRelations[];
  initialPagination: PaginationInfo;
  categories: ProductCategory[];
}

export default function ProductManagementClient({
  initialProducts,
  initialPagination,
  categories,
}: ProductManagementClientProps) {
  const [products, setProducts] =
    useState<ProductWithRelations[]>(initialProducts);
  const [pagination, setPagination] =
    useState<PaginationInfo>(initialPagination);
  const [localCategories, setLocalCategories] =
    useState<ProductCategory[]>(categories);
  const [currentPage, setCurrentPage] = useState(1);
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

  // Category sidebar state
  const [categorySidebarOpen, setCategorySidebarOpen] = useState(false);
  const [categoryError, setCategoryError] = useState("");

  // Import CSV sidebar state
  const [importSidebarOpen, setImportSidebarOpen] = useState(false);

  // Error states - separate for page and modal
  const [pageError, setPageError] = useState("");
  const [modalError, setModalError] = useState("");

  // Handle create category
  async function handleCreateCategory(data: CreateCategoryInput) {
    startTransition(async () => {
      try {
        const result = await createCategory(data);
        setLocalCategories((prev) =>
          [...prev, result.data].sort((a, b) => a.name.localeCompare(b.name)),
        );
        setCategorySidebarOpen(false);
        setCategoryError("");
      } catch (err) {
        setCategoryError(
          err instanceof Error ? err.message : "Error al crear categoría",
        );
      }
    });
  }

  // Refresh products list
  async function refreshProducts() {
    try {
      const result = await getProducts(
        filter,
        categoryFilter || undefined,
        searchQuery || undefined,
        currentPage,
        50,
      );
      setProducts(result.products);
      setPagination(result.pagination);
    } catch (err) {
      setPageError(
        err instanceof Error ? err.message : "Failed to fetch products",
      );
    }
  }

  // Filter handler
  async function handleFilterChange(newFilter: FilterType) {
    setFilter(newFilter);
    setCurrentPage(1); // Reset to first page on filter change
    startTransition(async () => {
      try {
        const result = await getProducts(
          newFilter,
          categoryFilter || undefined,
          searchQuery || undefined,
          1,
          50,
        );
        setProducts(result.products);
        setPagination(result.pagination);
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
    setCurrentPage(1); // Reset to first page on filter change
    startTransition(async () => {
      try {
        const result = await getProducts(
          filter,
          categoryId || undefined,
          searchQuery || undefined,
          1,
          50,
        );
        setProducts(result.products);
        setPagination(result.pagination);
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
    setCurrentPage(1); // Reset to first page on search
    startTransition(async () => {
      try {
        const result = await getProducts(
          filter,
          categoryFilter || undefined,
          query || undefined,
          1,
          50,
        );
        setProducts(result.products);
        setPagination(result.pagination);
      } catch (err) {
        setPageError(
          err instanceof Error ? err.message : "Failed to fetch products",
        );
      }
    });
  }

  // Handle create with optimistic update
  async function handleCreateProduct(
    data: CreateProductInput | EditProductInput,
  ) {
    const tempId = `temp-${Date.now()}`;
    setModalError(""); // Clear previous modal errors

    // Type guard: in create mode, data should be CreateProductInput
    const createData = data as CreateProductInput;

    startTransition(async () => {
      // Optimistically add product to UI (inside transition)
      const optimisticProduct: ProductWithRelations = {
        id: tempId,
        name: createData.name,
        description: createData.description || null,
        categoryId: createData.categoryId || null,
        category: createData.categoryId
          ? localCategories.find((c) => c.id === createData.categoryId) || null
          : null,
        imageUrl: createData.imageUrl || null,
        imagePublicId: createData.imagePublicId || null,
        active: true,
        createdAt: new Date(),
        updatedAt: new Date(),
        deletedAt: null,
        variants: createData.variants.map((v, idx) => ({
          id: `temp-variant-${idx}`,
          productId: tempId,
          sku: v.sku,
          name: v.name || null,
          price: v.price,
          costPrice: v.costPrice,
          imageUrl: v.imageUrl || null,
          imagePublicId: v.imagePublicId || null,
          displayName: v.displayName || v.name || null,
          // Use empty array for optimistic update - real data comes from server
          attributes: [],
          stock: {
            id: `temp-stock-${idx}`,
            productVariantId: `temp-variant-${idx}`,
            quantity: 0,
            minimumStock: 0,
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
        await createProduct(createData);
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
          ? localCategories.find((c) => c.id === data.categoryId) ||
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

  // Handle CSV import completion
  async function handleImportComplete() {
    await refreshProducts();
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
    <div className="flex-1 min-h-0 flex flex-col">
      {/* Page-level error display */}
      {pageError && (
        <div className="mb-4 shrink-0 bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded">
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
      <div className="mb-6 bg-white rounded-lg shadow p-4 shrink-0">
        {/* Row 1: Search + action buttons */}
        <div className="flex flex-wrap gap-2 mb-3">
          <input
            type="text"
            placeholder="Buscar productos o SKU..."
            value={searchQuery}
            onChange={(e) => handleSearch(e.target.value)}
            className="flex-1 min-w-48 px-3 py-2 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
          />

          <button
            onClick={() => setCategorySidebarOpen(true)}
            className="px-3 py-2 bg-white text-gray-700 border border-gray-300 rounded-md text-sm font-medium hover:bg-gray-50 flex items-center gap-1.5 whitespace-nowrap"
          >
            <svg
              className="h-4 w-4"
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
            Nueva Categoría
          </button>

          <button
            onClick={() => setImportSidebarOpen(true)}
            className="px-3 py-2 bg-white text-gray-700 border border-gray-300 rounded-md text-sm font-medium hover:bg-gray-50 flex items-center gap-1.5 whitespace-nowrap"
          >
            <svg
              className="h-4 w-4"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12"
              />
            </svg>
            Importar CSV
          </button>

          <button
            onClick={() => setCreateModalOpen(true)}
            className="px-3 py-2 bg-indigo-600 text-white rounded-md text-sm font-medium hover:bg-indigo-700 flex items-center gap-1.5 whitespace-nowrap"
          >
            <svg
              className="h-4 w-4"
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
            Nuevo Producto
          </button>
        </div>

        {/* Row 2: Status filters + category */}
        <div className="flex flex-wrap gap-2">
          <button
            onClick={() => handleFilterChange("all")}
            className={`px-3 py-1.5 text-sm font-medium rounded-md transition-colors ${
              filter === "all"
                ? "bg-indigo-600 text-white"
                : "bg-gray-100 text-gray-700 hover:bg-gray-200"
            }`}
          >
            Todos
          </button>
          <button
            onClick={() => handleFilterChange("active")}
            className={`px-3 py-1.5 text-sm font-medium rounded-md transition-colors ${
              filter === "active"
                ? "bg-indigo-600 text-white"
                : "bg-gray-100 text-gray-700 hover:bg-gray-200"
            }`}
          >
            Activos
          </button>
          <button
            onClick={() => handleFilterChange("inactive")}
            className={`px-3 py-1.5 text-sm font-medium rounded-md transition-colors ${
              filter === "inactive"
                ? "bg-indigo-600 text-white"
                : "bg-gray-100 text-gray-700 hover:bg-gray-200"
            }`}
          >
            Inactivos
          </button>

          <select
            value={categoryFilter}
            onChange={(e) => handleCategoryFilterChange(e.target.value)}
            className="px-3 py-1.5 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
          >
            <option value="">Todas las categorías</option>
            {localCategories.map((cat) => (
              <option key={cat.id} value={cat.id}>
                {cat.name}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Products table */}
      <div className="flex-1 min-h-0 flex flex-col">
        {isPending && products.length === 0 ? (
          <div className="text-center py-12 bg-white rounded-lg shadow">
            <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div>
            <p className="mt-2 text-sm text-gray-500">Cargando productos...</p>
          </div>
        ) : (
          <>
            <div className="table-scroll flex-1 overflow-y-scroll overflow-x-hidden min-h-0">
              <ProductTable
                products={filteredProducts}
                onView={handleViewProduct}
                onEdit={handleEditProduct}
                onDelete={handleDeleteClick}
                isPending={isPending}
              />
            </div>

            {/* Pagination controls */}
            {pagination.totalCount > 0 && (
              <div className="shrink-0 flex items-center justify-between px-6 py-4 bg-white border-t border-gray-200 rounded-b-lg shadow">
              <div className="text-sm text-gray-700">
                Mostrando{" "}
                {Math.min(
                  pagination.page * pagination.pageSize,
                  pagination.totalCount,
                )}{" "}
                de {pagination.totalCount} productos
              </div>

              <div className="flex gap-2">
                <button
                  onClick={() => {
                    const newPage = currentPage - 1;
                    setCurrentPage(newPage);
                    startTransition(async () => {
                      try {
                        const result = await getProducts(
                          filter,
                          categoryFilter || undefined,
                          searchQuery || undefined,
                          newPage,
                          50,
                        );
                        setProducts(result.products);
                        setPagination(result.pagination);
                      } catch (err) {
                        setPageError(
                          err instanceof Error
                            ? err.message
                            : "Failed to fetch products",
                        );
                      }
                    });
                  }}
                  disabled={pagination.page === 1 || isPending}
                  className="px-4 py-2 border border-gray-300 rounded-md text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Previous
                </button>

                <span className="px-4 py-2 text-sm text-gray-700">
                  Page {pagination.page} of {pagination.totalPages}
                </span>

                <button
                  onClick={() => {
                    const newPage = currentPage + 1;
                    setCurrentPage(newPage);
                    startTransition(async () => {
                      try {
                        const result = await getProducts(
                          filter,
                          categoryFilter || undefined,
                          searchQuery || undefined,
                          newPage,
                          50,
                        );
                        setProducts(result.products);
                        setPagination(result.pagination);
                      } catch (err) {
                        setPageError(
                          err instanceof Error
                            ? err.message
                            : "Failed to fetch products",
                        );
                      }
                    });
                  }}
                  disabled={!pagination.hasMore || isPending}
                  className="px-4 py-2 border border-gray-300 rounded-md text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Next
                </button>
              </div>
            </div>
          )}
          </>
        )}
      </div>

      {createModalOpen && (
        <Sidebar
          isOpen={createModalOpen}
          onClose={() => {
            setCreateModalOpen(false);
            setModalError("");
          }}
          title="Crear nuevo producto"
          size="lg"
        >
          <ProductForm
            mode="create"
            categories={localCategories}
            onSubmit={handleCreateProduct}
            onCancel={() => {
              setCreateModalOpen(false);
              setModalError("");
            }}
            isPending={isPending}
            error={modalError}
          />
        </Sidebar>
      )}

      {/* Edit product sidebar */}
      {editModalOpen && editingProduct && (
        <Sidebar
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
            categories={localCategories}
            onSubmit={(data) => handleUpdateProduct(editingProduct.id, data)}
            onCancel={() => {
              setEditModalOpen(false);
              setEditingProduct(null);
              setModalError(""); // Clear error on cancel
            }}
            isPending={isPending}
            error={modalError}
          />
        </Sidebar>
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

      {/* New category sidebar */}
      {categorySidebarOpen && (
        <CategorySidebar
          onSubmit={handleCreateCategory}
          onClose={() => {
            setCategorySidebarOpen(false);
            setCategoryError("");
          }}
          isPending={isPending}
          error={categoryError}
        />
      )}

      {/* Import CSV sidebar */}
      {importSidebarOpen && (
        <ImportCSVSidebar
          onClose={() => setImportSidebarOpen(false)}
          onImportComplete={handleImportComplete}
        />
      )}
    </div>
  );
}
