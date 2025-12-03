import React from 'react';
import { Page, Text, View, Document, StyleSheet } from '@react-pdf/renderer';

// Estilos corregidos (Sin shorthands problemáticos)
const styles = StyleSheet.create({
  page: { 
    padding: 40, 
    fontSize: 10, 
    fontFamily: 'Helvetica',
    backgroundColor: '#ffffff'
  },
  header: { 
    flexDirection: 'row', 
    justifyContent: 'space-between', 
    marginBottom: 20, 
    borderBottomWidth: 2,
    borderBottomColor: '#333',
    borderBottomStyle: 'solid',
    paddingBottom: 10
  },
  title: { 
    fontSize: 18, 
    fontWeight: 'bold', 
    textTransform: 'uppercase' 
  },
  companyInfo: { 
    fontSize: 9, 
    color: '#555',
    marginTop: 4
  },
  
  sectionTitle: { 
    fontSize: 12, 
    fontWeight: 'bold', 
    marginTop: 10, 
    marginBottom: 5, 
    backgroundColor: '#f0f0f0', 
    padding: 4 
  },
  
  row: { 
    flexDirection: 'row', 
    justifyContent: 'space-between', 
    marginBottom: 4 
  },
  
  rowTotal: { 
    flexDirection: 'row', 
    justifyContent: 'space-between', 
    marginTop: 5, 
    borderTopWidth: 2,
    borderTopColor: '#000',
    borderTopStyle: 'solid',
    paddingTop: 5, 
    fontWeight: 'bold'
  },
  
  colsContainer: { 
    flexDirection: 'row', 
    justifyContent: 'space-between', 
    gap: 20 
  },
  col: { 
    width: '48%' 
  },

  totalBox: {
    marginTop: 20, 
    padding: 8, 
    borderWidth: 2,
    borderColor: '#333',
    borderStyle: 'solid',
    backgroundColor: '#f9f9f9'
  },

  liquidBox: {
      marginTop: 30,
      padding: 10,
      backgroundColor: '#eee',
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center'
  },

  footer: { 
    position: 'absolute', 
    bottom: 40, 
    left: 40, 
    right: 40, 
    textAlign: 'center', 
    fontSize: 8, 
    color: '#888' 
  },
  
  signatureBox: { 
    marginTop: 60, 
    borderTopWidth: 1,
    borderTopColor: '#000',
    borderTopStyle: 'solid',
    width: '40%', 
    alignSelf: 'center', 
    paddingTop: 5, 
    textAlign: 'center' 
  }
});

const currency = (amount) => `$ ${Number(amount || 0).toLocaleString('es-CL')}`;

const PayslipPDF = ({ employee, data, period }) => (
  <Document>
    <Page size="LETTER" style={styles.page}>
      
      {/* ENCABEZADO */}
      <View style={styles.header}>
        <View>
          <Text style={styles.title}>Liquidación de Sueldo</Text>
          <Text style={styles.companyInfo}>Periodo: {period}</Text>
        </View>
        <View style={{ alignItems: 'flex-end' }}>
            <Text>{employee.first_name} {employee.last_name}</Text>
            <Text>RUT: {employee.rut}</Text>
            <Text>{employee.job?.name || 'Cargo no definido'}</Text>
        </View>
      </View>

      {/* CUERPO EN 2 COLUMNAS */}
      <View style={styles.colsContainer}>
        
        {/* COLUMNA IZQUIERDA: HABERES */}
        <View style={styles.col}>
            <Text style={styles.sectionTitle}>HABERES IMPONIBLES</Text>
            <View style={styles.row}><Text>Sueldo Base</Text><Text>{currency(data.sueldoBase)}</Text></View>
            <View style={styles.row}><Text>Gratificación Legal</Text><Text>{currency(data.gratificacion)}</Text></View>
            {data.extraItems?.filter(i => i.type === 'HABER_IMP').map((item, idx) => (
                <View key={idx} style={styles.row}><Text>{item.name}</Text><Text>{currency(item.amount)}</Text></View>
            ))}
            <View style={styles.rowTotal}><Text>Total Imponible</Text><Text>{currency(data.totalImponible)}</Text></View>

            <Text style={styles.sectionTitle}>HABERES NO IMPONIBLES</Text>
            {data.extraItems?.filter(i => i.type === 'NO_IMP').map((item, idx) => (
                <View key={idx} style={styles.row}><Text>{item.name}</Text><Text>{currency(item.amount)}</Text></View>
            ))}
             <View style={styles.rowTotal}><Text>Total No Imponible</Text><Text>{currency(data.colacionMovil)}</Text></View>

             <View style={styles.totalBox}>
                 <View style={styles.row}><Text>TOTAL HABERES</Text><Text>{currency(data.totalImponible + data.colacionMovil)}</Text></View>
             </View>
        </View>

        {/* COLUMNA DERECHA: DESCUENTOS */}
        <View style={styles.col}>
            <Text style={styles.sectionTitle}>DESCUENTOS LEGALES</Text>
            <View style={styles.row}><Text>AFP ({employee.pension?.name})</Text><Text>{currency(data.afpAmount)}</Text></View>
            <View style={styles.row}><Text>Salud ({employee.health?.name})</Text><Text>{currency(data.saludAmount)}</Text></View>
            <View style={styles.row}><Text>Seguro Cesantía</Text><Text>{currency(data.cesantiaAmount)}</Text></View>
            <View style={styles.rowTotal}><Text>Total Leyes Sociales</Text><Text>{currency(data.totalDescuentosLegales)}</Text></View>

            <Text style={styles.sectionTitle}>OTROS DESCUENTOS</Text>
            {data.extraItems?.filter(i => i.type === 'DESC').map((item, idx) => (
                <View key={idx} style={styles.row}><Text>{item.name}</Text><Text>{currency(item.amount)}</Text></View>
            ))}
            <View style={styles.rowTotal}><Text>Total Otros Desc.</Text><Text>{currency(data.totalOtrosDescuentos)}</Text></View>

            <View style={styles.totalBox}>
                 <View style={styles.row}><Text>TOTAL DESCUENTOS</Text><Text>{currency(data.totalDescuentos)}</Text></View>
             </View>
        </View>

      </View>

      {/* LIQUIDO FINAL */}
      <View style={styles.liquidBox}>
          <Text style={{ fontSize: 14 }}>LÍQUIDO A PAGAR</Text>
          <Text style={{ fontSize: 16 }}>{currency(data.sueldoLiquido)}</Text>
      </View>
      
      <View style={{ marginTop: 5 }}>
          <Text style={{ fontSize: 8, fontStyle: 'italic' }}>Son: {data.sueldoLiquido} pesos.</Text>
      </View>

      {/* FIRMA */}
      <View style={styles.signatureBox}>
          <Text>Firma Trabajador</Text>
          <Text style={{ fontSize: 8, marginTop: 2 }}>RUT: {employee.rut}</Text>
      </View>

      <Text style={styles.footer}>
          Documento generado electrónicamente por SaaS RRHH - {new Date().toLocaleDateString()}
      </Text>
    </Page>
  </Document>
);

export default PayslipPDF;