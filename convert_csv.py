#!/usr/bin/env python3
"""
CSV Converter for Portfolium
Converts broker CSV format to Portfolium import format

Input format:
Logo,Name,Ticker,ISIN,Date,Quantity,Operation,Fee,Unit Price,Total Price,Month,Year,Currency,Note

Output format:
date,symbol,type,quantity,price,fees,currency,notes
"""

import csv
import sys
from datetime import datetime
from pathlib import Path


def convert_date(date_str):
    """Convert DD/MM/YYYY to YYYY-MM-DD"""
    try:
        dt = datetime.strptime(date_str, "%d/%m/%Y")
        return dt.strftime("%Y-%m-%d")
    except ValueError:
        print(f"Warning: Invalid date format: {date_str}")
        return date_str


def convert_currency(currency):
    """Convert currency name to ISO code"""
    currency_map = {
        'euro': 'EUR',
        'dollar': 'USD',
        'pound': 'GBP',
        'eur': 'EUR',
        'usd': 'USD',
        'gbp': 'GBP'
    }
    return currency_map.get(currency.lower().strip(), currency.upper())


def convert_operation(operation):
    """Convert operation type to Portfolium format"""
    operation_map = {
        'buy': 'BUY',
        'sell': 'SELL',
        'dividend': 'DIVIDEND',
        'fee': 'FEE',
        'split': 'SPLIT'
    }
    return operation_map.get(operation.lower().strip(), operation.upper())


def convert_csv(input_file, output_file=None):
    """Convert broker CSV to Portfolium format"""
    
    # Determine output file name
    if output_file is None:
        input_path = Path(input_file)
        output_file = input_path.parent / f"{input_path.stem}_converted.csv"
    
    converted_count = 0
    errors = []
    
    try:
        with open(input_file, 'r', encoding='utf-8') as infile:
            # Try to detect delimiter
            sample = infile.read(1024)
            infile.seek(0)
            
            # Check if tab-separated
            delimiter = '\t' if '\t' in sample and ',' not in sample.split('\n')[0] else ','
            
            reader = csv.DictReader(infile, delimiter=delimiter)
            
            with open(output_file, 'w', encoding='utf-8', newline='') as outfile:
                writer = csv.writer(outfile)
                
                # Write header
                writer.writerow(['date', 'symbol', 'type', 'quantity', 'price', 'fees', 'currency', 'notes'])
                
                for row_num, row in enumerate(reader, start=2):
                    try:
                        # Extract and convert fields
                        date = convert_date(row.get('Date', '').strip())
                        symbol = row.get('Ticker', '').strip().upper()
                        tx_type = convert_operation(row.get('Operation', '').strip())
                        quantity = row.get('Quantity', '').strip()
                        price = row.get('Unit Price', '').strip()
                        fees = row.get('Fee', '').strip() or '0'
                        currency = convert_currency(row.get('Currency', '').strip())
                        notes = row.get('Note', '').strip()
                        
                        # Validate required fields
                        if not all([date, symbol, tx_type, quantity]):
                            errors.append(f"Row {row_num}: Missing required fields")
                            continue
                        
                        # Write converted row
                        writer.writerow([date, symbol, tx_type, quantity, price, fees, currency, notes])
                        converted_count += 1
                        
                    except Exception as e:
                        errors.append(f"Row {row_num}: {str(e)}")
        
        # Print results
        print(f"\n✅ Conversion completed!")
        print(f"📥 Input file: {input_file}")
        print(f"📤 Output file: {output_file}")
        print(f"✨ Converted: {converted_count} transactions")
        
        if errors:
            print(f"\n⚠️  Errors encountered:")
            for error in errors:
                print(f"   {error}")
        
        return True
        
    except FileNotFoundError:
        print(f"❌ Error: File not found: {input_file}")
        return False
    except Exception as e:
        print(f"❌ Error: {str(e)}")
        return False


def main():
    """Main entry point"""
    if len(sys.argv) < 2:
        print("Usage: python convert_csv.py <input_file.csv> [output_file.csv]")
        print("\nExample:")
        print("  python convert_csv.py my_transactions.csv")
        print("  python convert_csv.py my_transactions.csv converted.csv")
        sys.exit(1)
    
    input_file = sys.argv[1]
    output_file = sys.argv[2] if len(sys.argv) > 2 else None
    
    success = convert_csv(input_file, output_file)
    sys.exit(0 if success else 1)


if __name__ == "__main__":
    main()
