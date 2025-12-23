import pandas as pd
import numpy as np
import os
import networkx as nx
from textblob import TextBlob
from sklearn.preprocessing import StandardScaler, MinMaxScaler
from sklearn.ensemble import IsolationForest
from sklearn.cluster import KMeans
from sklearn.feature_extraction.text import CountVectorizer # NEW
from scipy import stats
import re, io,base64
from wordcloud import WordCloud
from datetime import datetime, timedelta
import requests
import io
import pandas as pd



try:
    from wordcloud import WordCloud
    HAS_WORDCLOUD = True
except ImportError:
    HAS_WORDCLOUD = False
    print("⚠️ Warning: 'wordcloud' library not found. Word Cloud node will not work.")
# --- GOOGLE DRIVE SETUP ---
SERVICE_ACCOUNT_FILE = 'service_account.json'
SCOPES = ['https://www.googleapis.com/auth/drive.readonly']
class WorkflowEngine:
    def __init__(self):
        self.context_data = {} 

    async def execute_flow(self, nodes, edges):
        execution_log = []
        self.context_data = {} 
        node_outputs = {} 
        # --- NODES THAT WILL SEND DATA TO FRONTEND REPORT/PANEL ---
        DISPLAY_NODES = [
            'Preview Data', 'Describe Stats', 'Get Data Types', 'Correlation', 
            'Bar Chart', 'Line Chart', 'Pie/Donut Chart', 
            'Histogram', 'Scatter Plot', 'Heatmap', 'Sentiment Analysis', 
            'Forecast', 'Clustering', 'KPI Card', 'Pivot Table', 'Rank', 'Area Chart',
            'Value Counts', 'Get Shape', 'N-Grams', 'Word Count','Word Cloud'
        ]
        G = nx.DiGraph()
        node_map = {n['id']: n for n in nodes}
        
        if not nodes: return {"status": "error", "message": "Empty Workflow", "logs": []}

        for n in nodes: G.add_node(n['id'], **n['data'])
        for e in edges: G.add_edge(e['source'], e['target'])

        try: execution_order = list(nx.topological_sort(G))
        except: execution_order = [n['id'] for n in nodes] 

        for node_id in execution_order:
            node = node_map.get(node_id)
            if not node: continue
            
            node_type = node.get('data', {}).get('typeLabel')
            config = node.get('data', {}).get('config', {})
            
            predecessors = list(G.predecessors(node_id))
            input_df = self.context_data.get(predecessors[0]) if predecessors else None

            try:
                output_df = input_df 

                # --- 1. INPUTS ---
                if node_type == 'Read Data':
                    output_df = self._load_data(node, predecessors, node_map)
                    execution_log.append(f"✅ [Step {node_id}] Loaded {len(output_df)} rows")
                    
                # --- SAFETY CHECK FOR ALL OTHER NODES ---
                elif input_df is None:
                    execution_log.append(f"⚠️ [Step {node_id}] Skipped '{node_type}': No input data from previous step.")
                    output_df = None # Propagate None
                    
                elif node_type == 'Fill N/A':
                    # Retrieve configuration settings
                    method = config.get('method', 'value')
                    fill_value = config.get('value') 
                    target_column = config.get('column') # Can be None/'' for all columns

                    # 1. Determine the target columns
                    if target_column:
                        target_cols = [target_column]
                    else:
                        # If no specific column is chosen, target all columns in the DataFrame
                        target_cols = input_df.columns.tolist()

                    # 2. Check for columns that actually exist in the DataFrame
                    valid_target_cols = [col for col in target_cols if col in input_df.columns]

                    if not valid_target_cols:
                        execution_log.append(f"⚠️ [Step {node_id}] No valid columns found to fill N/A. Skipping.")
                        output_df = input_df
                    else:
                        try:
                            # Initialize a new DataFrame copy to work on
                            output_df = input_df.copy()
                            
                            imputation_applied = False
                            
                            if method == 'value':
                                if fill_value is not None and fill_value != '':
                                    # Attempt to convert fill_value to numeric if all target columns are numeric
                                    for col in valid_target_cols:
                                        try:
                                            # Try to impute with the specific value
                                            output_df[col] = output_df[col].fillna(fill_value)
                                            imputation_applied = True
                                        except Exception:
                                            # If conversion fails or other error, just skip this specific column
                                            pass
                                
                            elif method in ['ffill', 'bfill']:
                                # Forward Fill (ffill) or Backward Fill (bfill)
                                for col in valid_target_cols:
                                    output_df[col] = output_df[col].fillna(method=method)
                                imputation_applied = True
                                
                            elif method in ['mean', 'median', 'mode', 'min', 'max']:
                                # Statistical methods (only apply to numeric columns)
                                # Note: mode requires special handling as it returns a Series
                                for col in valid_target_cols:
                                    if pd.api.types.is_numeric_dtype(output_df[col]):
                                        if method == 'mode':
                                            # Mode is the most frequent value. [0] is used to take the first mode
                                            impute_val = output_df[col].mode().iloc[0] if not output_df[col].mode().empty else None
                                        else:
                                            # Calculate the aggregate function (mean, median, min, max)
                                            impute_val = getattr(output_df[col], method)()
                                            
                                        if impute_val is not None:
                                            output_df[col] = output_df[col].fillna(impute_val)
                                            imputation_applied = True

                            if imputation_applied:
                                log_message = f"✅ [Step {node_id}] Filled N/A using {method} on columns: {', '.join(valid_target_cols)}"
                                execution_log.append(log_message)
                            else:
                                execution_log.append(f"⚠️ [Step {node_id}] Imputation method '{method}' applied but no changes made (e.g., non-numeric data).")
                                output_df = input_df # Restore original if no imputation occurred

                        except Exception as e:
                            execution_log.append(f"❌ [Step {node_id}] Error applying fill N/A ({method}): {e}")
                            output_df = input_df # Fallback to original DataFrame    
                    
                elif node_type == 'Drop Null': # Assuming the node type is 'Drop Null' or similar
                    # Configuration for pandas df.dropna()
                    # Assuming frontend provides config keys: 'subset' and 'how'
                    subset_cols = config.get('subset', []) # List of columns to consider (optional)
                    how_option = config.get('how', 'any')   # 'any' (default) or 'all'
                    
                    # 1. Validate inputs
                    if how_option not in ['any', 'all']:
                        execution_log.append(f"❌ [Step {node_id}] Invalid 'how' option '{how_option}'. Must be 'any' or 'all'.")
                        output_df = input_df
                    else:
                        # 2. Prepare subset list for pandas
                        if subset_cols:
                            # Filter subset_cols to only include columns existing in the DataFrame
                            valid_subset = [col for col in subset_cols if col in input_df.columns]
                        else:
                            valid_subset = None # Pass None to check all columns (pandas default)
                            
                        try:
                            # 3. Apply dropna operation
                            output_df = input_df.dropna(
                                how=how_option,
                                subset=valid_subset
                            )
                            
                            rows_dropped = len(input_df) - len(output_df)
                            execution_log.append(f"✅ [Step {node_id}] Dropped {rows_dropped} rows with null values (how='{how_option}'). Retained {len(output_df)} rows.")

                        except Exception as e:
                            execution_log.append(f"❌ [Step {node_id}] Failed to drop null values: {e}")
                            output_df = input_df # Pass the original DataFrame if operation fails
                elif node_type in ['SQL Database', 'MongoDB', 'OneDrive', 'Stream / Kafka']:
                    # In a real app, these would connect to external sources.
                    # Here we pass a mock empty DF or rely on Read Data to handle the actual fetch
                    # For simulation, we treat them as configuration nodes that Read Data uses.
                    execution_log.append(f"🔗 [Step {node_id}] {node_type} Configured")
                    output_df = None # These are sources, they don't output data directly until 'Read Data' uses them
                

                
                                
                elif node_type == 'Get Data Types':
                    output_df = pd.DataFrame(input_df.dtypes.astype(str)).reset_index()
                    output_df.columns = ['Column', 'Type']
                    
                elif node_type == 'Get Shape':
                    output_df = pd.DataFrame([{'Rows': input_df.shape[0], 'Columns': input_df.shape[1]}])
                
                elif node_type == 'Word Cloud':
                    col = config.get('column')
                    max_words = int(config.get('maxWords', 100))
                    # GET HEIGHT FROM CONFIG (Default to 400 if missing)
                    img_height = int(config.get('height', 400)) 
                    
                    if HAS_WORDCLOUD and col and col in input_df.columns:
                        try:
                            # Drop NAs and join text
                            text_series = input_df[col].dropna().astype(str)
                            if not text_series.empty:
                                text = " ".join(text_series.tolist())
                                
                                # Generate with dynamic height
                                wc = WordCloud(
                                    width=800, 
                                    height=img_height,  # <--- UPDATED HERE
                                    background_color='#1e293b', 
                                    colormap='Blues',
                                    max_words=max_words
                                ).generate(text)
                                
                                # Convert to Base64
                                buffer = io.BytesIO()
                                wc.to_image().save(buffer, format="PNG")
                                img_str = base64.b64encode(buffer.getvalue()).decode()
                                
                                # Store image
                                self.context_data[f"{node_id}_image"] = f"data:image/png;base64,{img_str}"
                                output_df = pd.DataFrame([{"Status": "Generated"}]) 
                        except Exception as e:
                            execution_log.append(f"❌ WordCloud Error: {e}")
                    else:
                        execution_log.append("⚠️ WordCloud skipped (Lib missing or no column)")
                        output_df = pd.DataFrame([{"Result": "Skipped"}])

                # --- 2. CLEANING ---
                elif node_type == 'Drop Duplicates':
                    cols = config.get('columns', [])
                    keep = config.get('keep', 'first')
                    if keep == 'false': keep = False
                    
                    if cols: output_df = input_df.drop_duplicates(subset=cols, keep=keep)
                    else: output_df = input_df.drop_duplicates(keep=keep)
                    execution_log.append(f"✅ Dropped duplicates. New count: {len(output_df)}")

                elif node_type == 'Replace Value':
                    col = config.get('column')
                    old_val = config.get('oldValue')
                    new_val = config.get('newValue')
                    if col and old_val is not None:
                        output_df = input_df.copy()
                        # Basic type inference for replacement
                        if output_df[col].dtype == 'int64' or output_df[col].dtype == 'float64':
                            try: 
                                old_val = float(old_val)
                                new_val = float(new_val)
                                output_df[col] = output_df[col].replace(old_val, new_val)
                            
                            except: pass
                        if output_df[col].dtype == 'object' or output_df[col].dtype == 'string':
                            try: old_val = str(old_val); new_val = str(new_val); output_df[col] = output_df[col].replace(old_val, new_val)
                            except: pass
                        output_df[col] = output_df[col].replace(old_val, new_val)
                        execution_log.append(f"✅ [Step {node_id}] Replaced values in {col}")

                elif node_type == 'Rename Columns':
                    old_name = config.get('oldName')
                    new_name = config.get('newName')
                    if old_name and new_name:
                        output_df = input_df.rename(columns={old_name: new_name})
                        execution_log.append(f"✅ [Step {node_id}] Renamed {old_name} to {new_name}")

                elif node_type == 'Change Data Type':
                    col = config.get('column')
                    dtype = config.get('dtype')
                    output_df = input_df.copy()
                    if col and dtype and col in output_df.columns:
                        try:
                            if dtype == 'int': output_df[col] = pd.to_numeric(output_df[col], errors='coerce').fillna(0).astype(int)
                            elif dtype == 'float': output_df[col] = pd.to_numeric(output_df[col], errors='coerce')
                            elif dtype == 'datetime': output_df[col] = pd.to_datetime(output_df[col], errors='coerce')
                            elif dtype == 'str': output_df[col] = output_df[col].astype(str)
                            execution_log.append(f"✅ [Step {node_id}] Changed data type of {col} to {dtype}")
                        except Exception as e:
                            execution_log.append(f"⚠️ Type cast failed: {e}")
                        
                elif node_type == 'Filter Date':
                        # Check for the new dateRanges configuration established in the frontend
                    date_ranges = config.get('dateRanges', [])
                    
                    if date_ranges:
                        try:
                            # Assumes a new method to handle multiple date range conditions
                            output_df = self._apply_date_range_filter(input_df, date_ranges)
                            execution_log.append(f"✅ [Step {node_id}] Filtered date ranges down to {len(output_df)} rows")
                        except Exception as e:
                            execution_log.append(f"❌ [Step {node_id}] Failed to apply date range filter: {e}")
                            # If filtering fails, we might want to stop or pass the original DataFrame
                            output_df = input_df
                # --- 3. FILTERING ---
                elif node_type == 'Filter Rows':
                    conditions = config.get('conditions', [])
                    if conditions:
                        output_df = self._apply_multi_filter(input_df, conditions)
                        execution_log.append(f"✅ [Step {node_id}] Filtered to {len(output_df)} rows")

                # --- SELECT COLUMNS ---
                elif node_type in ['Select Columns', 'List Columns']:
                    # Get the list of columns from the checkbox config
                    cols_to_keep = config.get('columns', [])
                    
                    if cols_to_keep and isinstance(cols_to_keep, list):
                        # Safety Check: Only keep columns that actually exist in the current dataframe
                        # This prevents crashes if a column was renamed or dropped earlier in the flow
                        valid_cols = [c for c in cols_to_keep if c in input_df.columns]
                        
                        if valid_cols:
                            output_df = input_df[valid_cols].copy()
                            execution_log.append(f"✅ Selected {len(valid_cols)} columns")
                        else:
                            # Warning if none of the selected columns exist
                            execution_log.append("⚠️ Warning: None of the selected columns were found in the data")
                            output_df = pd.DataFrame() # Return empty DF to avoid downstream crashes
                    else:
                        # If user unchecked everything, return empty DF (or you could choose to return all)
                        execution_log.append("ℹ️ No columns selected")
                        output_df = input_df[[]].copy()

                # --- 4. GROUPING & AGGREGATION ---
                elif node_type == 'Group By':
                    output_df = self._apply_group(input_df, config)
                    execution_log.append(f"✅ [Step {node_id}] Grouped Data")

                elif node_type == 'Pivot Table':
                    idx, c, v = config.get('index'), config.get('columns'), config.get('values')
                    if idx and v and idx in input_df.columns and v in input_df.columns: 
                        output_df = input_df.pivot_table(index=idx, columns=c, values=v, aggfunc=config.get('aggFunc', 'sum')).reset_index()
                    else:
                        output_df = input_df.copy()
                    execution_log.append(f"✅ [Step {node_id}] Pivot Table Created")
                
                elif node_type == 'Calculated Field':
                    # Retrieve configuration settings
                    new_column = config.get('newColumn')
                    expression = config.get('expression')
                    
                    # Check for mandatory inputs
                    if not new_column or not expression:
                        execution_log.append(f"❌ [Step {node_id}] Calculated Field requires a 'newColumn' name and an 'expression'. Skipping.")
                        output_df = input_df
                    else:
                        try:
                            # Create a shallow copy of the DataFrame to operate on, ensuring input_df is not mutated
                            output_df = input_df.copy()
                            
                            # Context for evaluation: only expose the DataFrame (df)
                            # This is a critical security measure to prevent arbitrary code execution
                            local_vars = {'df': output_df} 
                            
                            # Execute the expression and assign the result to the new column
                            # The result of the expression (e.g., a pandas Series) is calculated using eval
                            # and then assigned to the new column in the output_df.
                            output_df[new_column] = eval(expression, {}, local_vars)
                            
                            execution_log.append(f"✅ [Step {node_id}] Created new column '{new_column}' using expression: {expression}")

                        except KeyError as e:
                            execution_log.append(f"❌ [Step {node_id}] Error: Column {e} not found in the DataFrame.")
                            output_df = input_df
                            
                        except Exception as e:
                            execution_log.append(f"❌ [Step {node_id}] Failed to execute calculation expression '{expression}': {e}")
                            output_df = input_df
                
                # --- NEW: N-GRAMS ANALYSIS ---
                elif node_type == 'N-Grams':
                    col = config.get('column')
                    n_val = int(config.get('n', 2)) # Default Bigram
                    if col and col in input_df.columns:
                        # Drop NA and ensure string
                        text_data = input_df[col].dropna().astype(str)
                        if not text_data.empty:
                            vec = CountVectorizer(ngram_range=(n_val, n_val), stop_words='english', max_features=50)
                            bag_of_words = vec.fit_transform(text_data)
                            sum_words = bag_of_words.sum(axis=0) 
                            words_freq = [(word, sum_words[0, idx]) for word, idx in vec.vocabulary_.items()]
                            words_freq = sorted(words_freq, key = lambda x: x[1], reverse=True)
                            output_df = pd.DataFrame(words_freq, columns=['N-Gram', 'Frequency'])
                            execution_log.append(f"✅ Generated {n_val}-Grams")

                # --- NEW: WORD COUNT ---
                elif node_type == 'Word Count':
                    col = config.get('column')
                    if col and col in input_df.columns:
                        output_df = input_df.copy()
                        output_df['Word_Count'] = output_df[col].astype(str).apply(lambda x: len(x.split()))
                        execution_log.append(f"✅ Word counts calculated for {col}")
                        
                # --- 6. SORTING & RANKING ---
                elif node_type == 'Sort Data':
                    col = config.get('column')
                    order = config.get('order', 'asc')
                    if col:
                        output_df = input_df.sort_values(by=col, ascending=(order=='asc'))
                        execution_log.append(f"✅ [Step {node_id}] Sorted by {col}")
                        
                elif node_type == 'Trend Analysis':
                    date_col, period, agg = config.get('dateColumn'), config.get('period', 'M'), config.get('agg', 'count')
                    val_col = config.get('valueColumn')
                    if date_col:
                        temp = input_df.copy()
                        temp[date_col] = pd.to_datetime(temp[date_col])
                        temp = temp.set_index(date_col)
                        if agg == 'count': output_df = temp.resample(period).size().reset_index(name='Count')
                        else: output_df = temp.resample(period)[val_col].agg(agg).reset_index()
                        execution_log.append(f"✅ [Step {node_id}] Trend Analysis")
                        
                elif node_type == 'Rank':
                    col = config.get('column')
                    method = config.get('method', 'average')
                    asc = config.get('order', 'asc') == 'asc'
                    if col:
                        output_df = input_df.copy()
                        output_df[f'{col}_rank'] = output_df[col].rank(method=method, ascending=asc)
                        execution_log.append(f"✅ [Step {node_id}] Ranked {col}")

                # --- FALLBACK FOR VISUALIZATION ---
                elif node_type in ['Bar Chart', 'Line Chart', 'Pie/Donut Chart', 'Histogram']:
                    x_col = config.get('column')
                    y_col = config.get('yAxis')
                    
                    if x_col and x_col in input_df.columns:
                        temp_df = input_df.copy()
                        
                        # 1. Clean Data (Remove Nulls in X)
                        temp_df = temp_df.dropna(subset=[x_col])
                        
                        # 2. Smart Aggregation logic:
                        # If X is categorical and not unique, we probably need to group it.
                        is_unique = temp_df[x_col].is_unique
                        if not is_unique:
                            if y_col and y_col in temp_df.columns:
                                # If Y exists, Group by X and Sum/Mean Y
                                temp_df[y_col] = pd.to_numeric(temp_df[y_col], errors='coerce')
                                output_df = temp_df.groupby(x_col)[y_col].sum().reset_index()
                            else:
                                # If No Y, just Count occurrences of X
                                output_df = temp_df[x_col].value_counts().reset_index()
                                output_df.columns = [x_col, 'Count'] # Standardize Y name
                        else:
                            # Already unique/aggregated? Just pass it through.
                            output_df = temp_df
                    execution_log.append(f"📊 [Step {node_id}] Chart Configured")
                elif node_type == 'Scatter Plot':
                    output_df = input_df.copy()
                    # Ensure selected cols are numeric for scatter
                    x = config.get('column')
                    y = config.get('yAxis')
                    if x and y:
                        output_df[x] = pd.to_numeric(output_df[x], errors='coerce')
                        output_df[y] = pd.to_numeric(output_df[y], errors='coerce')
                        output_df = output_df.dropna(subset=[x, y])
                    execution_log.append(f"📊 [Step {node_id}] Scatter plot executed")
                        
                elif node_type == 'KPI Card':
                    col = config.get('column')
                    op = config.get('operation', 'count')
                    val = 0
                    label = config.get('label') or f"{op} {col if col else 'Rows'}"

                    if not col:
                        val = len(input_df)
                        label = config.get('label') or "Total Rows"
                    elif col in input_df.columns:
                        try:
                            clean_col = pd.to_numeric(input_df[col], errors='coerce')
                            if op == 'sum': val = clean_col.sum()
                            elif op == 'avg': val = clean_col.mean()
                            elif op == 'max': val = clean_col.max()
                            elif op == 'min': val = clean_col.min()
                            elif op == 'count': val = clean_col.count()
                        except: val = len(input_df)
                    output_df = pd.DataFrame([{ label: round(val, 2) if isinstance(val, (int, float)) else val }])

                elif node_type in ['Preview Data', 'Sample Data']:
                        # Retrieve configuration settings
                    mode = config.get('mode', 'head') # Default to 'head'
                    try:
                        # Ensure 'n' is an integer, defaulting to 10 if not found or invalid
                        n_rows = int(config.get('n', 10)) 
                    except ValueError:
                        execution_log.append(f"❌ [Step {node_id}] Invalid value provided for 'Number of Rows'. Using default (10).")
                        n_rows = 10
                    
                    # Check if the number of rows is positive
                    if n_rows <= 0:
                        execution_log.append(f"❌ [Step {node_id}] Number of Rows (n) must be a positive integer.")
                        output_df = input_df
                    else:
                        try:
                            # Determine the sampling method based on the configuration mode
                            if mode == 'head':
                                # Select the first N rows
                                output_df = input_df.head(n_rows)
                                
                            elif mode == 'tail':
                                # Select the last N rows
                                output_df = input_df.tail(n_rows)
                                
                            elif mode == 'random':
                                # Select a random sample of N rows
                                # Ensure n_rows does not exceed the total number of rows
                                n_actual = min(n_rows, len(input_df))
                                output_df = input_df.sample(n=n_actual, random_state=42) # Using a fixed random_state for reproducibility
                                
                            else:
                                execution_log.append(f"❌ [Step {node_id}] Invalid selection mode '{mode}'. Defaulting to input data.")
                                output_df = input_df

                            # Log the successful operation
                            execution_log.append(f"✅ [Step {node_id}] Sampled data using '{mode}' mode, resulting in {len(output_df)} rows.")

                        except Exception as e:
                            execution_log.append(f"❌ [Step {node_id}] Failed to sample data: {e}")
                            output_df = input_df

                elif node_type == 'Value Counts':
                    col = config.get('column')
                    # print("values counts columns is :",col)
                    if col: output_df = input_df[col].value_counts().reset_index(name='Count').rename(columns={'index': col})
                    execution_log.append(f"📊 [Step {node_id}] value counts executed on {col} column")
                # SNAPSHOT
                self.context_data[node_id] = output_df
                
                if output_df is not None and not output_df.empty:
                    safe_df = output_df.replace([np.inf, -np.inf], np.nan).where(pd.notnull(output_df), None)
                    is_display = any(x in node_type for x in DISPLAY_NODES)
                    custom_image = self.context_data.get(f"{node_id}_image")
                    # node_outputs[node_id] = {
                    #     "id": node_id, "type": node_type, "config": config,
                    #     "rows": len(safe_df), "columns": list(safe_df.columns),
                    #     "preview": safe_df.head(100).to_dict(orient='records')
                    # }
                    node_outputs[node_id] = {
                        "id": node_id, "type": node_type, "config": config,
                        "rows": len(safe_df), "columns": list(safe_df.columns),
                        "preview": safe_df.head(100).to_dict(orient='records') if is_display else [],
                        "stats": safe_df.describe().to_dict() if not safe_df.empty else {},
                        "image": custom_image # <--- CRITICAL: Pass to frontend
                    }

            except Exception as e:
                execution_log.append(f"❌ Error at {node_type}: {str(e)}")
                continue

        # FINAL OUTPUT
        final_id = execution_order[-1] if execution_order else None
        final_df = self.context_data.get(final_id)
        
        stats_dict = {}
        if final_df is not None:
            final_df = final_df.replace([np.inf, -np.inf], np.nan).where(pd.notnull(final_df), None)
            try: stats_dict = final_df.describe(include=[np.number]).to_dict()
            except: pass

        return { "status": "success", "logs": execution_log, "node_outputs": node_outputs, "final_output": {"rows": len(final_df) if final_df is not None else 0, "preview": final_df.head(100).to_dict(orient='records') if final_df is not None else [], "stats": stats_dict} }

    def _load_data(self, node, parents, map):
        config = node['data'].get('config', {})
        # 1. Check direct config
        if config.get('selectedFile'):
            path = config['selectedFile']['path']
            if not os.path.exists(path): path = os.path.join("temp_uploads", os.path.basename(path))
            if path.endswith('.xlsx'): return pd.read_excel(path, sheet_name=config.get('selectedSheet', 0))
            return pd.read_csv(path)
        
        # 2. Check Parent Config (Upload Node)
        if parents:
            p_node = map[parents[0]]
            if p_node['data']['typeLabel'] == 'Upload File':
                files = p_node['data']['config'].get('uploadedFiles')
                if files:
                    path = files[0]['path']
                    if not os.path.exists(path): path = os.path.join("temp_uploads", os.path.basename(path))
                    return pd.read_csv(path) if path.endswith('.csv') else pd.read_excel(path)
        return pd.DataFrame()

    def _apply_multi_filter(self, df, conditions):
        for cond in conditions:
            col, op, val = cond.get('column'), cond.get('operator'), cond.get('value')
            if not col: continue
            if op == 'contains': df = df[df[col].astype(str).str.contains(str(val), na=False)]
            else:
                try: num_val = float(val)
                except: num_val = val
                if op == '==': df = df[df[col] == num_val]
                elif op == '!=': df = df[df[col] != num_val]
                elif op == '>': df = df[pd.to_numeric(df[col], errors='coerce') > num_val]
                elif op == '<': df = df[pd.to_numeric(df[col], errors='coerce') < num_val]
        return df

    def _apply_group(self, df, config):
        cols = config.get('groupColumns', [])
        # Fallback if user used single select
        if not cols and config.get('groupColumn'): cols = [config.get('groupColumn')]
        
        aggs = config.get('aggregations', [])
        
        if not cols: return df
        
        # If no aggs defined, default to count
        if not aggs:
            return df.groupby(cols).size().reset_index(name='Count')

        agg_dict = {}
        for agg in aggs:
            if agg.get('column') and agg.get('func'):
                # Pandas agg dict
                c = agg['column']
                f = agg['func']
                if c in agg_dict:
                    if isinstance(agg_dict[c], list): agg_dict[c].append(f)
                    else: agg_dict[c] = [agg_dict[c], f]
                else:
                    agg_dict[c] = f

        grouped = df.groupby(cols).agg(agg_dict).reset_index()
        
        # Flatten MultiIndex columns if created
        if isinstance(grouped.columns, pd.MultiIndex):
            grouped.columns = ['_'.join(col).strip() if col[1] else col[0] for col in grouped.columns.values]
            
        return grouped
    def _apply_date_range_filter(self, df, date_ranges):
        """
        Applies a list of date range conditions to the DataFrame.
        Each item in date_ranges is expected to be: 
        {'column': 'date_col', 'startDate': '2023-01-01', 'endDate': '2023-12-31'}
        """
        
        # 1. Start with a boolean series that includes all rows
        combined_mask = pd.Series(True, index=df.index) 

        for range_item in date_ranges:
            column = range_item.get('column')
            start_date = range_item.get('startDate')
            end_date = range_item.get('endDate')

            if not column or not start_date or not end_date:
                # Skip incomplete conditions
                continue

            # Ensure the column is in datetime format for comparison
            # Handle potential errors during conversion (e.g., if the column isn't a valid date)
            try:
                date_series = pd.to_datetime(df[column])
            except KeyError:
                # Column not found, skip this rule
                continue
            except Exception as e:
                # Failed to convert column to datetime, raise error or skip
                print(f"Warning: Column '{column}' could not be converted to datetime. Error: {e}")
                continue

            # 2. Create the mask for the current date range condition: (date >= start) AND (date <= end)
            start_mask = date_series >= start_date
            end_mask = date_series <= end_date
            
            # This range's specific mask
            range_mask = start_mask & end_mask
            
            # 3. Combine with the master mask using the AND operator (default for sequential filters)
            combined_mask = combined_mask & range_mask

        # 4. Apply the final combined mask to filter the DataFrame
        return df[combined_mask]
engine = WorkflowEngine()