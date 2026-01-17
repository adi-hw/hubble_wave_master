# Phase 2: Schema & Views - AVA Knowledge Base

## Executive Summary

This document contains the knowledge base and training data for AVA (Adaptive Virtual Assistant) to provide intelligent guidance for Phase 2 features: schema management, formula creation, view configuration, and form building. AVA uses this knowledge to help users through natural language interactions.

---

## AVA's Phase 2 Capabilities

### What AVA Can Help With

```
┌─────────────────────────────────────────────────────────────────┐
│                    AVA Phase 2 Expertise                         │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  Schema Management:                                             │
│  ✓ Recommend property types for specific use cases             │
│  ✓ Suggest optimal collection structures                       │
│  ✓ Identify circular dependencies in formulas                  │
│  ✓ Validate schema changes before applying                     │
│  ✓ Generate schema from natural language description           │
│                                                                  │
│  Formula Building:                                              │
│  ✓ Write formulas from plain English descriptions              │
│  ✓ Debug formula errors with explanations                      │
│  ✓ Optimize formula performance                                │
│  ✓ Suggest relevant functions for calculations                 │
│  ✓ Convert ServiceNow Business Rules to formulas               │
│                                                                  │
│  View Configuration:                                            │
│  ✓ Recommend best view type for data                           │
│  ✓ Create filters from natural language                        │
│  ✓ Suggest optimal column layouts                              │
│  ✓ Configure conditional formatting rules                      │
│  ✓ Build pivot tables from descriptions                        │
│                                                                  │
│  Troubleshooting:                                               │
│  ✓ Diagnose why formulas aren't calculating                    │
│  ✓ Explain why views are slow                                  │
│  ✓ Fix schema migration errors                                 │
│  ✓ Resolve validation issues                                   │
│  ✓ Guide migration from ServiceNow                             │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

---

## Property Type Knowledge

### Property Type Decision Tree

AVA uses this decision tree to recommend property types:

```
User Need → AVA Recommendation

"I need to store text"
  ↓
  ├─ Short text (< 255 chars) → Text
  ├─ Long text with formatting → Rich Text
  ├─ Structured data → JSON
  └─ Multi-line plain text → Text (with multiline option)

"I need to store numbers"
  ↓
  ├─ Whole numbers → Number (precision: 0)
  ├─ Decimals → Number (with precision)
  ├─ Money values → Currency
  ├─ Calculated values → Formula (result: number)
  └─ Aggregated values → Rollup

"I need to store dates/times"
  ↓
  ├─ Date only → Date
  ├─ Date and time → DateTime
  ├─ Time duration → Duration
  ├─ Calculated date → Formula (result: date)
  └─ Days until deadline → Formula with DATEDIFF

"I need to link records"
  ↓
  ├─ Link to one record → Reference
  ├─ Link to multiple records → Multi-Reference
  ├─ Copy value from linked record → Lookup
  ├─ Count linked records → Rollup (count)
  └─ Sum values from linked records → Rollup (sum)

"I need selections"
  ↓
  ├─ Single choice → Choice
  ├─ Multiple choices → Multi-Choice
  ├─ Yes/No → Boolean
  └─ Conditional choices → Choice (with cascading rules)

"I need special types"
  ↓
  ├─ User assignment → User or Multi-User
  ├─ File uploads → Attachment
  ├─ Location/address → Geolocation
  ├─ Parent-child hierarchy → Hierarchical
  └─ Calculated logic → Formula
```

### Property Type Reference

#### Text Property

**When to use:**
- Names, titles, descriptions
- Short identifiers (< 255 characters)
- Single-line input

**AVA Examples:**
```
User: "I need a field for the work order title"
AVA: "I recommend a Text property with:
      • Max length: 255 characters
      • Required: Yes
      • Indexed: Yes (for fast searching)
      Would you like me to create this?"

User: "Create a field for product description"
AVA: "For product descriptions, I suggest:
      1. Rich Text property (if you need formatting)
      2. Text property with multiline (if plain text is okay)
      Which would you prefer?"
```

**Configuration Options:**
- `maxLength`: Character limit (1-5000, default: 255)
- `minLength`: Minimum characters required
- `pattern`: Regex validation pattern
- `multiline`: Allow line breaks
- `defaultValue`: Default text value

#### Number Property

**When to use:**
- Quantities, counts, scores
- Measurements, ratings
- Sequential numbers

**AVA Examples:**
```
User: "Add a priority score field"
AVA: "I'll create a Number property for priority score.
      Should this be:
      • Calculated from other fields? → Use Formula
      • Manually entered? → Use Number
      • Sum from related records? → Use Rollup"

User: "I need a field for currency amounts"
AVA: "For monetary values, I strongly recommend the Currency property
      instead of Number because it:
      ✓ Stores currency code (USD, EUR, etc.)
      ✓ Formats values correctly
      ✓ Handles exchange rates
      ✓ Prevents rounding errors
      Shall I create a Currency property instead?"
```

**Configuration Options:**
- `precision`: Total digits (default: 10)
- `scale`: Decimal places (default: 2)
- `min`: Minimum value
- `max`: Maximum value
- `step`: Increment value
- `format`: Display format (number, percentage)

#### Formula Property

**When to use:**
- Values calculated from other properties
- Complex business logic without code
- Dynamic values based on conditions

**AVA Examples:**
```
User: "Calculate days until due date"
AVA: "I'll create a Formula property:

      Name: Days Until Due
      Formula: DATEDIFF(DueDate, TODAY(), 'days')
      Result Type: Number

      This will show:
      • Positive numbers for future dates
      • Negative numbers for overdue items
      • Updates automatically each day

      Would you like me to add this formula?"

User: "Show 'High' if priority is 1, 'Medium' if 2, else 'Low'"
AVA: "Here's the formula for that logic:

      IF(Priority = 1, 'High',
         IF(Priority = 2, 'Medium', 'Low'))

      However, I notice you're converting numbers to text.
      Consider using a Choice property instead for better:
      • Filtering and grouping
      • Visual indicators (colors)
      • Data validation

      Would you like me to show you both approaches?"
```

**Formula Best Practices (AVA teaches):**
```
✓ Keep formulas simple and readable
✓ Use comments for complex logic (with // )
✓ Cache results when possible (use 'On Save' strategy)
✓ Avoid circular dependencies
✓ Test with edge cases (null values, zeros)
✗ Don't nest too many IFs (use SWITCH instead)
✗ Don't reference formulas that reference formulas (slow)
```

#### Rollup Property

**When to use:**
- Aggregate data from related records
- Count, sum, average child records
- Calculated totals from relationships

**AVA Examples:**
```
User: "Count how many tasks each work order has"
AVA: "I'll create a Rollup property:

      Name: Task Count
      Source Collection: Tasks
      Relationship: WorkOrder (reference)
      Aggregation: Count

      This will automatically count all tasks linked to each work order.
      Would you like to add a filter? For example:
      • Count only open tasks
      • Count only high-priority tasks"

User: "Sum all line item amounts on an order"
AVA: "Perfect use case for a Rollup! Here's what I'll create:

      Name: Total Amount
      Source Collection: Line Items
      Source Property: Amount
      Relationship: Order (reference)
      Aggregation: Sum

      This will automatically calculate the total whenever:
      • Line items are added/removed
      • Line item amounts change

      Should I also create a 'Tax Total' and 'Grand Total' rollup?"
```

**Rollup Performance Notes (AVA warns about):**
```
⚠ Performance considerations:
• Rollups with 1000+ related records may be slow
• Consider caching strategy for frequently accessed rollups
• Use filters to limit records processed
• Avoid rollup-of-rollup patterns

💡 Optimization tips:
• Enable caching for expensive rollups
• Add indexes to relationship properties
• Use periodic recalculation for rarely changing data
```

#### Lookup Property

**When to use:**
- Copy a value from a related record
- Display information from linked records
- Avoid data duplication

**AVA Examples:**
```
User: "Show customer name on the order"
AVA: "I'll create a Lookup property:

      Name: Customer Name
      Source Reference: Customer (your reference property)
      Target Property: Name

      This will automatically show the customer's name on each order.
      The value updates if the customer name changes.

      Note: This is read-only. To edit, you'll need to:
      • Change the customer reference, OR
      • Edit the customer record directly"

User: "I want the customer email on orders too"
AVA: "I can add that as another Lookup property.

      However, since you're pulling multiple properties from Customer,
      consider these alternatives:

      Option 1: Multiple Lookups (Current approach)
      ✓ Simple and straightforward
      ✗ Adds several properties to schema

      Option 2: Display in UI only
      ✓ Cleaner schema
      ✓ Always current data
      ✗ Not available in formulas

      For now, I'll create the Email lookup. You can always remove
      it later if you prefer Option 2."
```

#### Geolocation Property

**When to use:**
- Store coordinates (latitude/longitude)
- Map addresses
- Calculate distances

**AVA Examples:**
```
User: "Track asset locations"
AVA: "I'll create a Geolocation property:

      Name: Asset Location
      Format: Coordinates and Address
      Geocoding: Enabled

      Users can:
      • Drop a pin on a map
      • Enter an address (auto-converts to coordinates)
      • Use their current location

      I'll also add a Map view so you can see all assets on a map.
      Sound good?"

User: "Calculate distance between two locations"
AVA: "To calculate distances, you'll need:

      1. Two Geolocation properties (you have: Location, Destination)
      2. A Formula property using GEODISTANCE:

         GEODISTANCE(Location, Destination, 'miles')

      This returns the straight-line distance.
      For driving distance, you'll need integration with a
      mapping service (Google Maps, Mapbox).

      Would you like me to create the formula property?"
```

#### Currency Property

**When to use:**
- Monetary values
- Multi-currency amounts
- Financial calculations

**AVA Examples:**
```
User: "Add price field"
AVA: "I'll create a Currency property:

      Name: Price
      Default Currency: USD
      Precision: 2 decimal places

      This property stores both the amount and currency code.
      If you need multi-currency support, I can:
      • Enable currency selection per record
      • Add exchange rate calculations
      • Create a 'Price in USD' formula for reporting

      Do you need multi-currency support?"

User: "Convert all prices to USD for reporting"
AVA: "I'll create a Formula property:

      Name: Price USD
      Formula: CURRENCYCONVERT(Price, 'USD', ExchangeRateDate)
      Result Type: Number

      This requires:
      ✓ Currency property (Price)
      ✓ Date property for exchange rate (or use TODAY())
      ✓ Exchange rate data source

      Would you like me to set up the exchange rate integration?"
```

---

## Formula Function Reference

### Formula Function Categories

AVA organizes functions by category for easy discovery:

#### Math Functions

```javascript
// SUM - Add numbers together
SUM(value1, value2, ...)
Examples:
  SUM(Subtotal, Tax, Shipping)  // Total order amount
  SUM(HoursMonday, HoursTuesday, HoursWednesday)  // Weekly hours

// ROUND - Round to decimal places
ROUND(value, decimals)
Examples:
  ROUND(Price * 1.08, 2)  // Add 8% tax, round to cents
  ROUND(Average, 0)  // Round to whole number

// ABS - Absolute value
ABS(value)
Examples:
  ABS(ActualCost - EstimatedCost)  // Cost variance (always positive)

// MIN, MAX - Smallest or largest value
MIN(value1, value2, ...)
MAX(value1, value2, ...)
Examples:
  MIN(DeadlineA, DeadlineB)  // Earliest deadline
  MAX(0, DaysOverdue)  // Show overdue days or 0

// POWER - Exponentiation
POWER(base, exponent)
Examples:
  POWER(1 + InterestRate, Years)  // Compound interest multiplier

// SQRT - Square root
SQRT(value)
Examples:
  SQRT(Area)  // Side length of square
```

**AVA Usage Examples:**
```
User: "Calculate total price with tax"
AVA: "Here's the formula:
      ROUND(SUM(Price, Price * TaxRate), 2)

      Breaking this down:
      • Price * TaxRate → tax amount
      • SUM(Price, taxAmount) → total
      • ROUND(..., 2) → round to cents

      If you prefer sales tax as a percentage (like 8.5):
      ROUND(Price * (1 + TaxRate/100), 2)"
```

#### Text Functions

```javascript
// CONCAT - Join text together
CONCAT(text1, text2, ...)
Examples:
  CONCAT(FirstName, ' ', LastName)  // Full name
  CONCAT(Code, '-', YEAR(Date))  // Reference number

// UPPER, LOWER - Change case
UPPER(text)
LOWER(text)
Examples:
  UPPER(Status)  // "ACTIVE" instead of "active"
  LOWER(Email)  // Normalize email addresses

// LEFT, RIGHT, MID - Extract characters
LEFT(text, count)
RIGHT(text, count)
MID(text, start, count)
Examples:
  LEFT(ProductCode, 3)  // First 3 characters
  RIGHT(Phone, 4)  // Last 4 digits
  MID(SSN, 4, 2)  // Middle 2 digits (from position 4)

// TRIM - Remove extra spaces
TRIM(text)
Examples:
  TRIM(UserInput)  // Clean up user-entered text

// REPLACE - Replace text
REPLACE(text, oldText, newText)
Examples:
  REPLACE(Phone, '-', '')  // Remove dashes: "555-1234" → "5551234"

// LEN - Text length
LEN(text)
Examples:
  LEN(Description) > 100  // Check if too long

// FIND - Search for text
FIND(searchText, withinText)
Examples:
  FIND('@', Email)  // Position of @ symbol
  IF(FIND('urgent', Description) > 0, 'High', 'Normal')  // Keyword detection
```

**AVA Usage Examples:**
```
User: "Create full name from first and last name"
AVA: "Use this formula:
      CONCAT(FirstName, ' ', LastName)

      For better formatting (handles middle names, suffixes):
      TRIM(CONCAT(FirstName, ' ', MiddleName, ' ', LastName, ' ', Suffix))

      The TRIM removes extra spaces if fields are empty."

User: "Generate reference number like WO-2024-001234"
AVA: "Here's a formula to create that format:
      CONCAT('WO-', YEAR(CreatedDate), '-',
             RIGHT('000000' + Number, 6))

      This creates:
      • 'WO-' prefix
      • 4-digit year
      • 6-digit padded number (001234)

      Example: WO-2024-001234"
```

#### Date Functions

```javascript
// TODAY, NOW - Current date/time
TODAY()  // Current date at midnight
NOW()  // Current date and time
Examples:
  DATEDIFF(DueDate, TODAY(), 'days')  // Days until due
  IF(LastLogin < TODAY() - 30, 'Inactive', 'Active')  // User activity

// DATEDIFF - Date difference
DATEDIFF(date1, date2, unit)
Units: 'days', 'months', 'years', 'hours', 'minutes'
Examples:
  DATEDIFF(DueDate, TODAY(), 'days')  // Days until/overdue
  DATEDIFF(EndDate, StartDate, 'hours')  // Duration in hours
  DATEDIFF(BirthDate, TODAY(), 'years')  // Age

// DATEADD - Add to date
DATEADD(date, amount, unit)
Examples:
  DATEADD(OrderDate, 7, 'days')  // 7 days after order
  DATEADD(StartDate, 3, 'months')  // 3 months later
  DATEADD(NOW(), 2, 'hours')  // 2 hours from now

// YEAR, MONTH, DAY - Extract components
YEAR(date)
MONTH(date)
DAY(date)
Examples:
  YEAR(OrderDate)  // 2024
  MONTH(CreatedDate) = 12  // December orders
  DAY(DueDate)  // Day of month

// WEEKDAY - Day of week
WEEKDAY(date)
Returns: 1 (Sunday) to 7 (Saturday)
Examples:
  WEEKDAY(Date) = 1  // Sunday
  IF(WEEKDAY(DueDate) > 5, 'Weekend', 'Weekday')

// DATEFORMAT - Format date as text
DATEFORMAT(date, format)
Formats: 'MM/DD/YYYY', 'DD-MMM-YYYY', 'YYYY-MM-DD', etc.
Examples:
  DATEFORMAT(OrderDate, 'MMM DD, YYYY')  // "Dec 24, 2024"
  DATEFORMAT(NOW(), 'YYYY-MM-DD HH:mm')  // "2024-12-24 14:30"
```

**AVA Usage Examples:**
```
User: "Show if a work order is overdue"
AVA: "Use this formula:
      IF(DueDate < TODAY() AND Status != 'Done',
         'OVERDUE',
         '')

      This checks:
      • Is due date in the past?
      • Is status not done?
      • If both true → 'OVERDUE'
      • Otherwise → blank

      Want to show days overdue instead?
      IF(DueDate < TODAY() AND Status != 'Done',
         CONCAT(DATEDIFF(TODAY(), DueDate, 'days'), ' days overdue'),
         '')"

User: "Calculate age from birthdate"
AVA: "Here's the formula:
      DATEDIFF(BirthDate, TODAY(), 'years')

      This automatically accounts for leap years.

      For more precise age (years and months):
      CONCAT(
        DATEDIFF(BirthDate, TODAY(), 'years'), ' years, ',
        MOD(DATEDIFF(BirthDate, TODAY(), 'months'), 12), ' months'
      )"
```

#### Logic Functions

```javascript
// IF - Conditional value
IF(condition, valueIfTrue, valueIfFalse)
Examples:
  IF(Quantity > 100, 'Bulk', 'Regular')  // Customer type
  IF(Score >= 90, 'A', IF(Score >= 80, 'B', 'C'))  // Letter grade
  IF(Status = 'Done', CompletedDate, DueDate)  // Relevant date

// SWITCH - Multiple conditions
SWITCH(value, case1, result1, case2, result2, ..., default)
Examples:
  SWITCH(Priority,
    1, 'High',
    2, 'Medium',
    3, 'Low',
    'Unknown')  // Better than nested IFs

// AND, OR, NOT - Logical operators
AND(condition1, condition2, ...)
OR(condition1, condition2, ...)
NOT(condition)
Examples:
  AND(Status = 'Open', Priority = 'High')  // High priority open items
  OR(Category = 'Bug', Category = 'Error')  // Issues
  NOT(Archived)  // Active records

// ISBLANK, ISNOTNULL - Check for empty values
ISBLANK(value)
ISNOTNULL(value)
Examples:
  IF(ISBLANK(AssignedTo), 'Unassigned', AssignedTo.Name)
  ISNOTNULL(CompletedDate)  // Has been completed
```

**AVA Usage Examples:**
```
User: "Set priority score: High=100, Medium=50, Low=10"
AVA: "I recommend SWITCH instead of nested IFs:

      SWITCH(Priority,
        'High', 100,
        'Medium', 50,
        'Low', 10,
        0)  // Default for unknown values

      This is cleaner than:
      IF(Priority='High', 100, IF(Priority='Medium', 50, 10))

      Easier to read and maintain!"

User: "Check if required fields are filled"
AVA: "Use AND with ISNOTNULL:

      AND(
        ISNOTNULL(Title),
        ISNOTNULL(Status),
        ISNOTNULL(AssignedTo)
      )

      This returns:
      • TRUE if all fields have values
      • FALSE if any field is empty

      You can use this in:
      • Validation rules
      • Conditional formatting
      • Workflow triggers"
```

#### Reference Functions

```javascript
// LOOKUP - Get value from related record
LOOKUP(referenceProperty, targetProperty)
Examples:
  LOOKUP(Customer, 'Email')  // Customer's email
  LOOKUP(ParentTask, 'DueDate')  // Parent task due date

// COUNTIF - Count matching records
COUNTIF(collection, condition)
Examples:
  COUNTIF(Tasks, Status = 'Open')  // Open task count
  COUNTIF(LineItems, Quantity > 10)  // Bulk items

// SUMIF - Conditional sum
SUMIF(collection, property, condition)
Examples:
  SUMIF(LineItems, Amount, Taxable = true)  // Taxable total
  SUMIF(Expenses, Amount, Approved = true)  // Approved expenses
```

**AVA Usage Examples:**
```
User: "Show customer email on the order"
AVA: "Use the LOOKUP function:

      LOOKUP(Customer, 'Email')

      This gets the email from the Customer record referenced
      by your Customer property.

      Note: If you need this frequently, consider creating a
      Lookup property instead of a Formula. It's more efficient!"

User: "Count how many high-priority tasks"
AVA: "Use COUNTIF:

      COUNTIF(Tasks, Priority = 'High')

      This counts all related Task records where Priority = 'High'.

      For multiple conditions:
      COUNTIF(Tasks, AND(Priority = 'High', Status = 'Open'))

      This counts high-priority open tasks only."
```

---

## View Type Guidance

### View Type Decision Matrix

AVA helps users choose the right view type:

```
Data Characteristics → Recommended View Type

Tabular data, many columns → List View
  Best for: Spreadsheet-like data, filtering, sorting
  Features: Inline editing, aggregations, export

Item details with images → Card View or Gallery View
  Card: Structured layouts with metadata
  Gallery: Image-focused, minimal text

Time-based data → Calendar View or Timeline View
  Calendar: Events, appointments, deadlines
  Timeline: Projects, schedules, dependencies

Status-based workflow → Kanban View
  Best for: Task management, workflow stages
  Features: Drag-and-drop, WIP limits, swimlanes

Location-based data → Map View
  Best for: Assets, service areas, routes
  Features: Clustering, custom markers, popups

Multi-dimensional analysis → Pivot View
  Best for: Reports, aggregations, cross-tabs
  Features: Dynamic grouping, multiple values

Project schedules → Gantt View
  Best for: Project planning, dependencies
  Features: Timeline bars, milestones, critical path
```

### View Configuration Examples

#### List View

**AVA Conversation:**
```
User: "Create a view for all open work orders"
AVA: "I'll create a List view with these settings:

      Name: Open Work Orders
      Type: List
      Filters:
        • Status not equals 'Done'
        • Status not equals 'Cancelled'

      Columns I suggest:
        • Number (frozen, always visible)
        • Title
        • Priority (with color coding)
        • Assigned To
        • Due Date
        • Status

      Sorting:
        • Priority (High to Low)
        • Then Due Date (soonest first)

      Additional features:
        ☑ Show row numbers
        ☑ Enable inline editing
        ☑ Show total count
        ☐ Show overdue items in red (conditional formatting)

      Should I add the conditional formatting for overdue items?"
```

#### Kanban View

**AVA Conversation:**
```
User: "Set up a board to track work order progress"
AVA: "Perfect! I'll create a Kanban view:

      Name: Work Order Board
      Type: Kanban

      Column Property: Status
      Columns will be:
        • New
        • Assigned
        • In Progress
        • Review
        • Done

      Card Configuration:
      ┌─────────────────────────────┐
      │ 🔴 WO-001234  ⋮            │
      │ Server Maintenance          │
      │ 👤 John Smith  ⏰ Due Today │
      └─────────────────────────────┘

      Shows:
        • Priority color indicator
        • Work order number
        • Title
        • Assigned user
        • Due date

      WIP Limits:
        • In Progress: 4 items max
        • Review: 2 items max

      Would you like to add swimlanes (e.g., by Priority)?"
```

#### Calendar View

**AVA Conversation:**
```
User: "Show work orders on a calendar by due date"
AVA: "I'll create a Calendar view:

      Name: Work Order Calendar
      Type: Calendar

      Configuration:
        • Date Property: Due Date
        • Title Property: Title
        • Color Property: Priority
          - High = Red
          - Medium = Orange
          - Low = Green

        • Default View: Month
        • First Day: Monday
        • Show Week Numbers: Yes

      Calendar Features:
        ✓ Click date to create new work order
        ✓ Drag events to reschedule
        ✓ Click event to view/edit
        ✓ Filter by assigned user

      Would you also like a Timeline view to see start/end dates?"
```

#### Pivot Table View

**AVA Conversation:**
```
User: "Analyze work orders by status and priority"
AVA: "I'll create a Pivot view:

      Name: Work Order Analysis
      Type: Pivot

      Configuration:
        Rows: Status
        Columns: Priority
        Values: Count of Work Orders

      This creates a table like:

      ┌────────────┬──────┬────────┬─────┬───────┐
      │            │ High │ Medium │ Low │ Total │
      ├────────────┼──────┼────────┼─────┼───────┤
      │ New        │   3  │    5   │  2  │   10  │
      │ Assigned   │   8  │   12   │  4  │   24  │
      │ In Progress│  15  │    8   │  3  │   26  │
      │ Review     │   4  │    3   │  1  │    8  │
      │ Done       │  45  │   67   │ 23  │  135  │
      ├────────────┼──────┼────────┼─────┼───────┤
      │ Total      │  75  │   95   │ 33  │  203  │
      └────────────┴──────┴────────┴─────┴───────┘

      Additional metrics to add?
        • Average completion time
        • Overdue count
        • Assigned user count"
```

---

## Schema Best Practices

### Schema Design Principles

AVA teaches these best practices:

#### 1. Naming Conventions

```
✓ Good Property Names:
  • DueDate (clear, concise)
  • AssignedTo (descriptive)
  • TotalAmount (indicates aggregation)
  • IsActive (boolean prefix)

✗ Avoid:
  • date (too generic)
  • user (ambiguous)
  • amt (abbreviation)
  • active (unclear type)

✓ Good Collection Names:
  • WorkOrders (plural, PascalCase)
  • Assets (clear, plural)
  • SupportTickets (descriptive)

✗ Avoid:
  • WO (abbreviation)
  • Asset (singular)
  • tickets (lowercase)
```

**AVA Guidance:**
```
User: "Create a field called 'desc'"
AVA: "I notice you're using an abbreviation ('desc').

      For better maintainability, I recommend:
      'Description' instead of 'desc'

      Reasons:
      ✓ Clearer to all users
      ✓ Better for formulas (more readable)
      ✓ Consistent with platform conventions
      ✓ Easier for future developers

      Should I create it as 'Description'?"
```

#### 2. Property Organization

```
✓ Group Related Properties:
  Basic Information:
    • Title
    • Description
    • Status

  Assignment:
    • AssignedTo
    • AssignedDate
    • Team

  Schedule:
    • StartDate
    • DueDate
    • CompletedDate

  Calculated:
    • DaysRemaining (formula)
    • PriorityScore (formula)
    • PercentComplete (formula)

✓ Order Matters:
  1. Identifiers (Number, Title)
  2. Status/Priority
  3. Assignment
  4. Dates
  5. Details
  6. Calculated fields
  7. System fields (Created, Modified)
```

**AVA Guidance:**
```
User: "Add 12 new fields to Work Orders"
AVA: "Before adding 12 fields, let's organize them into sections:

      I see fields for:
      • Assignment (4 fields)
      • Financial (3 fields)
      • Scheduling (3 fields)
      • Tracking (2 fields)

      I recommend creating form sections:

      Section 1: Assignment Details
      Section 2: Financial Information
      Section 3: Schedule
      Section 4: Progress Tracking

      This improves:
      ✓ User experience (logical grouping)
      ✓ Form performance (collapsible sections)
      ✓ Mobile usability (less scrolling)

      Shall I organize them this way?"
```

#### 3. Performance Optimization

```
✓ Index Properties Used For:
  • Searching (text fields)
  • Filtering (status, priority)
  • Sorting (dates, numbers)
  • Relationships (references)

✗ Don't Index:
  • Long text fields
  • Rarely queried properties
  • Calculated formulas (index source instead)
  • Attachment properties

✓ Cache Strategies:
  On Save: Expensive formulas, rarely changes
  Periodic: Time-based calculations (age, days until)
  Never: Real-time values, frequently changing data

✓ Relationship Optimization:
  • Avoid deep nesting (3+ levels)
  • Limit rollups on large datasets
  • Use filters in rollups
  • Consider denormalization for read-heavy data
```

**AVA Guidance:**
```
User: "Create a formula that calculates average from 10,000 records"
AVA: "⚠ Performance Warning!

      This formula will process 10,000 records every time it runs.

      Better approaches:

      Option 1: Rollup Property (Recommended)
        • Calculates incrementally as records change
        • Cached result, very fast to read
        • Auto-updates on changes

      Option 2: Periodic Formula
        • Runs once per hour/day
        • Cached between runs
        • Good for reports

      Option 3: Background Calculation
        • Runs asynchronously
        • Doesn't slow down UI
        • Updates within minutes

      Which approach fits your needs?"
```

---

## Common Troubleshooting

### Formula Issues

#### Issue: "Formula not calculating"

**AVA Diagnostic Steps:**
```
AVA: "Let me diagnose why your formula isn't calculating.

      Checking:
      ✓ Formula syntax valid
      ✗ Dependency property 'Priority' is empty

      The issue: Your formula references Priority, but this
      record has no Priority value set.

      Solutions:
      1. Set a default value for Priority
      2. Handle null values in formula:
         IF(ISBLANK(Priority), 0,
            IF(Priority = 'High', 100, 50))

      Would you like me to update the formula?"
```

#### Issue: "Circular dependency detected"

**AVA Explanation:**
```
AVA: "⚠ Circular Dependency Detected!

      Dependency Chain:
      PriorityScore → DueDate → EstimatedDueDate → PriorityScore

      This creates an infinite loop:
      • PriorityScore depends on DueDate
      • DueDate depends on EstimatedDueDate
      • EstimatedDueDate depends on PriorityScore

      To fix, you need to break the loop. Options:

      1. Remove formula from EstimatedDueDate
      2. Calculate EstimatedDueDate from non-formula properties
      3. Use a different property for PriorityScore calculation

      Which property should we change?"
```

#### Issue: "Formula too slow"

**AVA Optimization:**
```
AVA: "Your formula is taking 3.5 seconds to calculate.

      Performance Analysis:
      • 5 nested LOOKUP functions
      • Each traverses 200+ records
      • No caching enabled

      Optimization Recommendations:

      1. Enable Caching (Quick Fix)
         Cache Strategy: On Save
         Expected Speed: < 50ms after first calculation

      2. Denormalize Data (Better Long-term)
         Copy frequently accessed values to this collection
         Use Lookup properties instead of formulas

      3. Simplify Formula
         Current: 5 lookups
         Proposed: 2 lookups + stored values

      Would you like me to implement option #1 now?"
```

### View Performance Issues

#### Issue: "View loading slowly"

**AVA Diagnostic:**
```
AVA: "Analyzing your view performance...

      View: All Work Orders
      Records: 15,000
      Load Time: 8.2 seconds

      Issues Found:
      1. Loading all 15,000 records (no pagination)
      2. 3 formula properties calculated per record
      3. No indexes on filter properties

      Optimizations:

      1. Enable Pagination (Immediate Improvement)
         Load 50 records at a time
         Expected: 1.2 seconds initial load

      2. Add Indexes (Medium-term)
         Index Status and Priority properties
         Expected: 40% faster filtering

      3. Cache Formulas (Long-term)
         Enable 'On Save' caching for formulas
         Expected: 60% faster per-record calculation

      Shall I apply optimization #1 now?"
```

---

## Migration Assistance

### ServiceNow to HubbleWave Migration

#### Business Rule → Formula Conversion

**AVA Migration Guide:**
```
User: "Convert this ServiceNow Business Rule to HubbleWave"

      ServiceNow Code:
      if (current.priority == '1') {
          current.priority_score = 100;
      } else if (current.priority == '2') {
          current.priority_score = 50;
      } else {
          current.priority_score = 10;
      }

AVA: "I'll convert this Business Rule to a HubbleWave Formula:

      Property: Priority Score
      Type: Formula
      Result: Number

      Formula:
      SWITCH(Priority,
        '1', 100,
        '2', 50,
        10)

      Changes from ServiceNow:
      ✓ No code required (declarative)
      ✓ Automatic validation
      ✓ Real-time preview
      ✓ Built-in caching
      ✓ Version control

      This formula:
      • Maps priority '1' → 100
      • Maps priority '2' → 50
      • Defaults to 10 for all other values

      Should I create this formula property?"
```

#### Table → Collection Conversion

**AVA Migration:**
```
User: "Migrate ServiceNow incident table"

AVA: "I'll help migrate the incident table.

      Step 1: Analyzing ServiceNow schema...
      Found: 45 fields in incident table

      Field Mapping:
      ✓ number → Number (Text)
      ✓ short_description → Title (Text)
      ✓ description → Description (Rich Text)
      ✓ priority → Priority (Choice: 1-5)
      ✓ state → Status (Choice)
      ✓ assigned_to → AssignedTo (User)
      ✓ opened_by → CreatedBy (User)
      ✓ sys_created_on → CreatedDate (DateTime)

      Business Rules Found: 8
      ✓ 5 can auto-convert to formulas
      ⚠ 3 require manual review (complex logic)

      Client Scripts Found: 12
      ✓ 10 can convert to conditional logic
      ⚠ 2 require custom JavaScript

      Estimated Migration Time: 2-3 hours

      Proceed with automatic conversion?"
```

---

## AVA Conversation Templates

### Schema Creation

```
User: "Create a collection for tracking customer complaints"

AVA: "I'll create a Customer Complaints collection. Let me ask a few questions:

      1. What information do you need to track about each complaint?
         Suggested properties:
         • Title/Subject
         • Description
         • Customer (reference to Customers)
         • Status (New, Investigating, Resolved, Closed)
         • Priority (High, Medium, Low)
         • Assigned To (user)
         • Category (Product, Service, Billing, Other)
         • Date Received
         • Date Resolved

      2. Do you need any calculated fields?
         • Days Open (today - received date)
         • Resolution Time (resolved - received)
         • SLA Status (based on priority and days open)

      3. What relationships are needed?
         • Link to Customer (one complaint → one customer)
         • Link to Products (one complaint → multiple products)
         • Link to Support Tickets (one complaint → multiple tickets)

      Should I create the collection with these defaults, or would
      you like to customize further?"
```

### Formula Building

```
User: "I need a formula for SLA compliance"

AVA: "I'll help create an SLA compliance formula. Let me understand your requirements:

      1. What's your SLA based on?
         • Priority (High = 4 hours, Medium = 8 hours, Low = 24 hours)?
         • Time of day (business hours only)?
         • Day of week (exclude weekends)?

      2. How should we calculate it?
         • From creation date?
         • From assignment date?
         • From first response date?

      3. What should the formula return?
         • Text ("Compliant", "At Risk", "Breached")?
         • Number (hours remaining)?
         • Percentage (% of SLA time used)?

      Based on typical SLA needs, here's a starter formula:

      IF(
        Status = 'Resolved',
        IF(
          DATEDIFF(CreatedDate, ResolvedDate, 'hours') <=
            SWITCH(Priority, 'High', 4, 'Medium', 8, 24),
          'Compliant',
          'Breached'
        ),
        IF(
          DATEDIFF(CreatedDate, NOW(), 'hours') >=
            SWITCH(Priority, 'High', 3, 'Medium', 6, 20),
          'At Risk',
          'On Track'
        )
      )

      This checks:
      • If resolved: compare resolution time to SLA
      • If open: check if approaching SLA (80% threshold)

      Would you like me to adjust for business hours or weekends?"
```

### View Configuration

```
User: "Create a dashboard view"

AVA: "I'll help create a dashboard view. Let's define what you need:

      1. What data should the dashboard show?
         Suggested widgets:
         • Total count by status (bar chart)
         • Priority distribution (pie chart)
         • Trend over time (line chart)
         • Recent items (list)
         • Assigned to me (list)
         • Overdue items (list)

      2. Which is more important?
         • High-level overview (metrics and charts)
         • Actionable items (lists and tables)
         • Both equally

      3. Who will use this dashboard?
         • Executives (high-level metrics)
         • Managers (team performance)
         • Team members (personal tasks)

      Based on typical needs, I suggest:

      Top Row: Key Metrics
      ┌─────────┬─────────┬─────────┬─────────┐
      │  Total  │  Open   │ Overdue │ Resolved│
      │   203   │   68    │   12    │   135   │
      └─────────┴─────────┴─────────┴─────────┘

      Middle Row: Charts
      ┌──────────────────┬──────────────────────┐
      │  Status Chart    │  Priority Chart      │
      │  (Bar)           │  (Pie)               │
      └──────────────────┴──────────────────────┘

      Bottom Row: Action Items
      ┌──────────────────┬──────────────────────┐
      │  My Open Items   │  Overdue Items       │
      │  (List)          │  (List)              │
      └──────────────────┴──────────────────────┘

      Should I create this layout?"
```

---

## AVA Training Data Format

### Intent Recognition

AVA is trained to recognize these intents:

```yaml
# Schema Management Intents
create_collection:
  patterns:
    - "create a collection for {entity}"
    - "I need a new collection called {name}"
    - "make a {entity} collection"

create_property:
  patterns:
    - "add a field for {property}"
    - "create a {type} property called {name}"
    - "I need to track {property}"

modify_schema:
  patterns:
    - "change {property} to {type}"
    - "rename {old_name} to {new_name}"
    - "delete the {property} field"

# Formula Intents
create_formula:
  patterns:
    - "calculate {description}"
    - "create a formula for {calculation}"
    - "I need a calculated field that {logic}"

debug_formula:
  patterns:
    - "my formula isn't working"
    - "formula error: {error}"
    - "why isn't {formula} calculating"

optimize_formula:
  patterns:
    - "formula is too slow"
    - "improve formula performance"
    - "make {formula} faster"

# View Intents
create_view:
  patterns:
    - "create a {view_type} view for {collection}"
    - "I need a view that shows {criteria}"
    - "make a board for {workflow}"

configure_view:
  patterns:
    - "add {feature} to {view}"
    - "filter by {condition}"
    - "sort by {property}"

# Troubleshooting Intents
diagnose_issue:
  patterns:
    - "why is {feature} not working"
    - "{error_message}"
    - "I'm having trouble with {feature}"

migration:
  patterns:
    - "migrate from ServiceNow"
    - "convert {servicenow_feature}"
    - "import {entity} from {platform}"
```

### Entity Recognition

```yaml
entities:
  property_type:
    values:
      - text
      - number
      - date
      - datetime
      - boolean
      - choice
      - reference
      - formula
      - rollup
      - lookup
      - user
      - currency
      - geolocation
      - duration
      - attachment
      - rich_text

  view_type:
    values:
      - list
      - card
      - calendar
      - kanban
      - timeline
      - map
      - gallery
      - gantt
      - pivot

  aggregation:
    values:
      - sum
      - count
      - average
      - min
      - max
      - concat

  condition_operator:
    values:
      - equals
      - not equals
      - greater than
      - less than
      - contains
      - starts with
      - is empty
      - is not empty
```

---

## Conclusion

This knowledge base empowers AVA to:

✅ **Guide users** through complex schema design decisions
✅ **Generate formulas** from natural language descriptions
✅ **Recommend best practices** for performance and maintainability
✅ **Diagnose issues** and provide actionable solutions
✅ **Assist migration** from legacy platforms like ServiceNow
✅ **Teach users** through contextual examples and explanations

AVA transforms the learning curve from months to days by providing intelligent, contextual assistance throughout the platform.

---

*Document Version: 1.0*
*Phase Status: Planning*
*Last Updated: Phase 2 AVA Knowledge Base*
