# Jaffle Shop Data Modelling Example

This example demonstrates a complete data lakehouse architecture modelled in the Open Data Modelling workspace format. It is based on the [dbt Jaffle Shop](https://github.com/dbt-labs/jaffle-shop) project - a fictional restaurant chain that serves jaffles (grilled sandwiches).

## Overview

The Jaffle Shop example showcases:

- **19 ODCS Tables** across Bronze/Silver/Gold layers
- **2 Data Products** (Customer 360, Sales Analytics)
- **3 BPMN Processes** for data transformation flows
- **1 DuckDB System** representing the analytics lakehouse

## Quick Start

1. Open the Data Modelling application
2. Navigate to File > Open Workspace
3. Select the `examples/jaffleshop/` directory
4. The application will automatically load `jaffleshop.workspace.yaml` and all related files

## File Structure

```
examples/jaffleshop/
├── jaffleshop.workspace.yaml              # Workspace definition with domains, systems, relationships
├── README.md                              # This file
│
├── # Raw Layer (Bronze) - 6 Tables
├── jaffleshop_ecommerce_raw_customers.odcs.yaml
├── jaffleshop_ecommerce_raw_orders.odcs.yaml
├── jaffleshop_ecommerce_raw_items.odcs.yaml
├── jaffleshop_ecommerce_raw_products.odcs.yaml
├── jaffleshop_ecommerce_raw_supplies.odcs.yaml
├── jaffleshop_ecommerce_raw_stores.odcs.yaml
│
├── # Staging Layer (Silver) - 6 Tables
├── jaffleshop_ecommerce_stg_customers.odcs.yaml
├── jaffleshop_ecommerce_stg_orders.odcs.yaml
├── jaffleshop_ecommerce_stg_order_items.odcs.yaml
├── jaffleshop_ecommerce_stg_products.odcs.yaml
├── jaffleshop_ecommerce_stg_supplies.odcs.yaml
├── jaffleshop_ecommerce_stg_locations.odcs.yaml
│
├── # Mart Layer (Gold) - 7 Tables
├── jaffleshop_ecommerce_mart_customers.odcs.yaml
├── jaffleshop_ecommerce_mart_orders.odcs.yaml
├── jaffleshop_ecommerce_mart_order_items.odcs.yaml
├── jaffleshop_ecommerce_mart_products.odcs.yaml
├── jaffleshop_ecommerce_mart_locations.odcs.yaml
├── jaffleshop_ecommerce_mart_supplies.odcs.yaml
├── jaffleshop_ecommerce_mart_metricflow_time_spine.odcs.yaml
│
├── # Data Products - 2 Products
├── jaffleshop_ecommerce_customer360.odps.yaml
├── jaffleshop_ecommerce_sales_analytics.odps.yaml
│
└── # BPMN Processes - 3 Processes
├── jaffleshop_ecommerce_raw_ingestion.bpmn
├── jaffleshop_ecommerce_staging_transform.bpmn
└── jaffleshop_ecommerce_mart_build.bpmn
```

## Data Architecture

### Medallion Architecture (Bronze/Silver/Gold)

```
┌─────────────────────────────────────────────────────────────────────────┐
│                          DuckDB Lakehouse                                │
├─────────────────┬─────────────────────┬─────────────────────────────────┤
│  Bronze (Raw)   │   Silver (Staging)  │         Gold (Marts)            │
├─────────────────┼─────────────────────┼─────────────────────────────────┤
│ raw_customers   │ stg_customers       │ customers (dimension)           │
│ raw_orders      │ stg_orders          │ orders (fact)                   │
│ raw_items       │ stg_order_items     │ order_items (fact)              │
│ raw_products    │ stg_products        │ products (dimension)            │
│ raw_supplies    │ stg_supplies        │ supplies (dimension)            │
│ raw_stores      │ stg_locations       │ locations (dimension)           │
│                 │                     │ metricflow_time_spine           │
└─────────────────┴─────────────────────┴─────────────────────────────────┘
```

### Star Schema (Mart Layer)

```
                         ┌───────────────┐
                         │   products    │
                         │  (dimension)  │
                         └───────┬───────┘
                                 │
    ┌───────────────┐            │            ┌───────────────┐
    │   customers   │            │            │   supplies    │
    │  (dimension)  │            │            │  (dimension)  │
    └───────┬───────┘            │            └───────────────┘
            │                    │                    ▲
            │ customer_id        │ product_id         │
            │                    │                    │
            ▼                    ▼                    │
    ┌───────────────┐    ┌───────────────┐           │
    │    orders     │◄───│  order_items  │───────────┘
    │    (fact)     │    │    (fact)     │
    └───────┬───────┘    └───────────────┘
            │
            │ location_id
            ▼
    ┌───────────────┐
    │   locations   │
    │  (dimension)  │
    └───────────────┘
```

## Tables Summary

### Raw Layer (Bronze) - 6 Tables
| Table | Description | Key Fields |
|-------|-------------|------------|
| raw_customers | Customer master data | id, name |
| raw_orders | Order headers | id, customer, ordered_at, store_id, subtotal, tax_paid, order_total |
| raw_items | Order line items | id, order_id, sku |
| raw_products | Product catalog | sku, name, type, price, description |
| raw_supplies | Supply inventory | id, name, cost, perishable, sku |
| raw_stores | Store locations | id, name, opened_at, tax_rate |

### Staging Layer (Silver) - 6 Tables
| Table | Description | Transformations |
|-------|-------------|-----------------|
| stg_customers | Cleaned customers | ID normalization |
| stg_orders | Cleaned orders | Currency conversion (cents→dollars), date truncation |
| stg_order_items | Cleaned items | FK normalization |
| stg_products | Cleaned products | Type classification (food/drink flags) |
| stg_supplies | Cleaned supplies | Cost conversion |
| stg_locations | Cleaned locations | Renamed from stores |

### Mart Layer (Gold) - 7 Tables
| Table | Type | Key Metrics |
|-------|------|-------------|
| customers | Dimension | lifetime_order_count, lifetime_order_value |
| orders | Fact | order_total, item_count, is_first_order |
| order_items | Fact | product_price, supply_cost |
| products | Dimension | is_food_item, is_drink_item |
| locations | Dimension | tax_rate |
| supplies | Dimension | supply_cost, is_perishable |
| metricflow_time_spine | Dimension | date_day, date parts |

## Data Products

### Customer 360
A unified customer view for marketing and CRM applications.

**Use Cases:**
- Marketing campaign targeting
- Customer churn prediction
- Loyalty program management
- Personalization engines

**Input Tables:** stg_customers, stg_orders
**Output Tables:** customers, orders

### Sales Analytics
Revenue and operational insights for business intelligence.

**Use Cases:**
- Executive dashboards
- Financial reporting
- Inventory planning
- Location expansion decisions

**Input Tables:** stg_orders, stg_order_items, stg_products, stg_locations
**Output Tables:** orders, order_items, products, locations, metricflow_time_spine

## BPMN Processes

### 1. Raw Data Ingestion (`raw_ingestion.bpmn`)
Parallel extraction from source systems:
- Extract customers from CRM
- Extract orders & items from POS
- Extract products & supplies from catalog
- Validate schemas and load to raw tables

### 2. Staging Transformation (`staging_transform.bpmn`)
Sequential transformation pipeline:
- Stage customers (ID normalization)
- Stage locations (from raw_stores)
- Stage products (type classification)
- Stage supplies (cost conversion)
- Stage orders (currency conversion)
- Stage order items (FK normalization)
- Run data quality checks

### 3. Mart Build (`mart_build.bpmn`)
Dimensional model construction:
1. Build time spine dimension
2. Build dimensions in parallel (customers, products, locations, supplies)
3. Build orders fact with aggregations
4. Build order items fact with cost calculations
5. Validate mart integrity

## Integration Testing

This example can be used for automated testing:

```python
# Example test assertions
assert workspace.domains.count() == 1
assert domain.tables.count() == 19
assert domain.products.count() == 2
assert domain.processes.count() == 3

# Validate relationships
assert orders.foreign_keys['customer_id'].references(customers.customer_id)
assert orders.foreign_keys['location_id'].references(locations.location_id)
```

## File Naming Convention

Files follow the WorkspaceV2 flat file format:
- `{workspace}.workspace.yaml` - Workspace definition
- `{workspace}_{domain}_{table}.odcs.yaml` - ODCS table definitions
- `{workspace}_{domain}_{product}.odps.yaml` - ODPS data product definitions
- `{workspace}_{domain}_{process}.bpmn` - BPMN process definitions

## References

- [dbt Jaffle Shop Repository](https://github.com/dbt-labs/jaffle-shop)
- [dbt Documentation](https://docs.getdbt.com/)
- [DuckDB Documentation](https://duckdb.org/docs/)
- [Medallion Architecture](https://www.databricks.com/glossary/medallion-architecture)
- [ODCS (Open Data Contract Standard)](https://github.com/bitol-io/open-data-contract-standard)
- [ODPS (Open Data Product Standard)](https://github.com/opendataproducts/spec)
